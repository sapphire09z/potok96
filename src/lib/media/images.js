import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { deletePrivate, putPrivate } from "./s3.js";

const MAX_PIXELS = 25_000_000;
const WIDTHS = [320, 640, 960, 1440];
const TYPES = {
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  png: { ext: "png", mime: "image/png" },
  webp: { ext: "webp", mime: "image/webp" },
};

export class InvalidMediaError extends Error {}

export async function inspectImage(bytes) {
  let metadata;

  try {
    metadata = await sharp(bytes, {
      limitInputPixels: MAX_PIXELS,
      failOn: "error",
    }).metadata();
  } catch {
    throw new InvalidMediaError("Повреждённое или слишком большое изображение.");
  }

  if (
    !TYPES[metadata.format] ||
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > MAX_PIXELS ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new InvalidMediaError("Разрешены только обычные JPEG, PNG и WebP до 25 Мп.");
  }

  return TYPES[metadata.format];
}

export async function prepareImage(bytes) {
  const original = await inspectImage(bytes);
  const variants = [];

  try {
    for (const width of WIDTHS) {
      const converted = await sharp(bytes, {
        limitInputPixels: MAX_PIXELS,
        failOn: "error",
      })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

      variants.push({ width, bytes: converted });
    }
  } catch {
    throw new InvalidMediaError("Не удалось обработать изображение.");
  }

  return { original, variants };
}

export async function uploadPrivateImageSet({ bytes, area, entityId }) {
  if (!new Set(["ads", "news", "events", "orgs", "site"]).has(area)) {
    throw new Error("Unsupported media area");
  }
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(entityId)) {
    throw new Error("Invalid media owner key");
  }

  const image = await prepareImage(bytes);
  const photoId = randomUUID();
  const baseKey = `media/${area}/${entityId}/${photoId}`;
  const storedKeys = [];

  try {
    const originalKey = `${baseKey}/original.${image.original.ext}`;
    await putPrivate(originalKey, bytes, image.original.mime);
    storedKeys.push(originalKey);

    for (const variant of image.variants) {
      const key = `${baseKey}/${variant.width}.webp`;
      await putPrivate(key, variant.bytes, "image/webp");
      storedKeys.push(key);
    }
  } catch (error) {
    await cleanupPrivateKeys(storedKeys);
    throw error;
  }

  return { photoId, baseKey, storedKeys };
}

export async function cleanupPrivateKeys(keys) {
  await Promise.allSettled(keys.map((key) => deletePrivate(key)));
}
