import { getPrivate, putPublic, publicMediaUrl } from "@/lib/media/s3";
import { eventImageKey, EVENT_IMAGE_SIZES } from "./eventMediaPolicy.mjs";

export function eventImageUrl(eventId, image, width = 960) {
    if (!EVENT_IMAGE_SIZES.includes(width)) throw new Error("Invalid event cover width");
    return publicMediaUrl(`${eventImageKey(eventId, image)}/${width}.webp`);
}

// Public object keys include an immutable UUID, so interrupted retries are safe.
// Publish S3 variants BEFORE committing the public database cover pointer.
export async function promoteEventImage(eventId, image) {
    const base = eventImageKey(eventId, image);
    for (const size of EVENT_IMAGE_SIZES) {
        const key = `${base}/${size}.webp`;
        const object = await getPrivate(key);
        if (!object.Body) throw new Error("Missing private event image variant");
        const bytes = Buffer.from(await object.Body.transformToByteArray());
        await putPublic(key, bytes, "image/webp");
    }
}
