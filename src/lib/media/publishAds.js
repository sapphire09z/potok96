import { getPrivate, putPublic, publicMediaUrl } from "./s3.js";

export const PUBLIC_IMAGE_WIDTHS = [320, 640, 960, 1440];

// The photo ID is an immutable UUID: a public image URL never changes contents.
export function publicAdPhotoVariant(storageKey, width) {
  if (!PUBLIC_IMAGE_WIDTHS.includes(width)) {
    throw new Error("Unsupported public image width");
  }
  if (!/^media\/ads\/[a-zA-Z0-9_-]{1,100}\/[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new Error("Invalid ad photo storage key");
  }
  return publicMediaUrl(`${storageKey}/${width}.webp`);
}

// Publish only processed, metadata-free WebP images, never the originals.
// This operation is idempotent; it can be retried if the network fails.
export async function publishAdPhotos(photos) {
  // Check config before touching any objects.
  if (photos.length > 0) publicAdPhotoVariant(photos[0].storageKey, 320);

  for (const photo of photos) {
    for (const width of PUBLIC_IMAGE_WIDTHS) {
      const key = `${photo.storageKey}/${width}.webp`;
      const source = await getPrivate(key);
      if (!source.Body) throw new Error(`Private image is missing: ${key}`);
      const bytes = Buffer.from(await source.Body.transformToByteArray());
      await putPublic(key, bytes);
    }
  }
}
