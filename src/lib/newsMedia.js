import { getPrivate, putPublic, publicMediaUrl } from "@/lib/media/s3";

// The canonical article remains Markdown, but private editor image URLs must
// never reach a public page. Only images owned by this news record are allowed.
const SIZES = new Set(["320", "640", "960", "1440"]);
const PRIVATE_URL = /\/api\/editor\/news\/[^\s)"'<>]+/g;
const EXACT_PRIVATE_URL = /^\/api\/editor\/news\/(c[a-z0-9]{10,40})\/images\/([0-9a-f-]{36})(?:\?size=(320|640|960|1440))?$/i;

function validatedKey(post, image) {
    const expected = `media/news/${post.id}/${image.id}`;
    if (image.storageKey !== expected) {
        throw new Error("Invalid news image storage key");
    }
    return expected;
}

export function publicNewsCover(post) {
    const image = (post.images ?? []).find((item) => item.id === post.coverImageId);
    return image
        ? publicMediaUrl(`${validatedKey(post, image)}/960.webp`)
        : (post.cover || "");
}

export function publicNewsBody(post) {
    const byId = new Map((post.images ?? []).map((image) => [image.id.toLowerCase(), image]));
    const body = (post.body || "").replace(PRIVATE_URL, (address) => {
        const match = EXACT_PRIVATE_URL.exec(address);
        if (!match || match[1] !== post.id) throw new Error("Unknown private news image reference");
        const image = byId.get(match[2].toLowerCase());
        if (!image) throw new Error("Image in text is not attached to this news post");
        const size = match[3] || "960";
        if (!SIZES.has(size)) throw new Error("Unsupported image size");
        return publicMediaUrl(`${validatedKey(post, image)}/${size}.webp`);
    });
    if (body.includes("/api/editor/news/")) {
        throw new Error("Private editor image links cannot be published");
    }
    // Every inline image must belong to the article's audited gallery.
    // Pasted third-party image URLs have no rights record and must be uploaded
    // through the editorial image manager first.
    const allowed = new Set();
    for (const image of post.images ?? []) {
        const base = validatedKey(post, image);
        for (const size of SIZES) allowed.add(publicMediaUrl(`${base}/${size}.webp`));
    }
    const markdownImages = /!\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g;
    for (const match of body.matchAll(markdownImages)) {
        const target = match[1].replace(/^<|>$/g, "");
        if (!allowed.has(target)) {
            throw new Error("All inline photos must be uploaded via the news image gallery");
        }
    }
    return body;
}

// Copy first, change post status second. A failed copy leaves the article in
// APPROVED/UNPUBLISHED so an administrator can safely retry publishing.
// Repeating the writes to the same immutable image keys is idempotent.
export async function promoteNewsImages(post) {
    for (const image of post.images ?? []) {
        const base = validatedKey(post, image);
        for (const size of SIZES) {
            const key = `${base}/${size}.webp`;
            const object = await getPrivate(key);
            if (!object.Body) throw new Error(`Missing private image body: ${key}`);
            const bytes = Buffer.from(await object.Body.transformToByteArray());
            await putPublic(key, bytes, "image/webp");
        }
    }
}
