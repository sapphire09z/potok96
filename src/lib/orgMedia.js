import { getPrivate, putPublic, publicMediaUrl } from "@/lib/media/s3";

export const ORG_IMAGE_SIZES = [320, 640, 960, 1440];
export const ORG_IMAGE_LIMIT = 12;

export function organizationImageKey(orgId, image) {
    const key = `media/orgs/${orgId}/${image.id}`;
    if (image.storageKey !== key || !/^[a-zA-Z0-9_-]{8,80}$/.test(orgId) ||
        !/^[0-9a-f-]{36}$/i.test(image.id)) {
        throw new Error("Некорректный ключ фотографии организации.");
    }
    return key;
}

export function organizationImageUrl(orgId, image, size = 960) {
    if (!ORG_IMAGE_SIZES.includes(size)) throw new Error("Unsupported organization image size");
    return publicMediaUrl(`${organizationImageKey(orgId, image)}/${size}.webp`);
}

// Upload first, then atomically switch organization status. If S3 fails,
// publication must remain a draft. Repeated promotion uses immutable keys.
export async function promoteOrganizationImages(org) {
    for (const image of org.images ?? []) {
        const base = organizationImageKey(org.id, image);
        for (const size of ORG_IMAGE_SIZES) {
            const key = `${base}/${size}.webp`;
            const response = await getPrivate(key);
            if (!response.Body) throw new Error("Missing private media variant");
            const bytes = Buffer.from(await response.Body.transformToByteArray());
            await putPublic(key, bytes, "image/webp");
        }
    }
}
