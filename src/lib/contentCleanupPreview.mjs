// Stage 5.15.2.1: read-only planning for manual cleanup of trashed CMS records.
// Do not import DeleteObjectCommand or database mutation helpers here.
export const MAX_LISTED_OBJECTS = 1000;
export const CONTENT_KINDS = Object.freeze(["news", "events"]);
const POST_ID = /^c[a-z0-9]{10,40}$/;
const IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_SUFFIX = /^(original\.(jpg|png|webp)|(?:320|640|960|1440)\.webp)$/;
const PUBLIC_SUFFIX = /^(?:320|640|960|1440)\.webp$/;

export function mediaPrefix(kind, id) {
  if (!CONTENT_KINDS.includes(kind) || !POST_ID.test(id)) {
    throw new Error("Invalid CMS media prefix");
  }
  return `media/${kind}/${id}/`;
}

function analyzeBucket(objects, known, prefix, suffixPattern) {
  let size = 0;
  let unlinked = 0;
  let unexpected = 0;
  const recognized = [];
  for (const obj of objects) {
    // Defensive: do not trust object listings or identifiers outside the exact prefix.
    if (typeof obj.key !== "string" || !obj.key.startsWith(prefix) ||
        !Number.isSafeInteger(obj.bytes) || obj.bytes < 0) {
      throw new Error("Invalid S3 object metadata");
    }
    size += obj.bytes;
    const remainder = obj.key.slice(prefix.length);
    const slash = remainder.indexOf("/");
    if (slash < 0 || !IMAGE_ID.test(remainder.slice(0, slash))) {
      unexpected += 1;
      continue;
    }
    const folder = remainder.slice(0, slash);
    const suffix = remainder.slice(slash + 1);
    if (!known.has(folder.toLowerCase())) {
      unlinked += 1;
    } else if (!suffixPattern.test(suffix)) {
      unexpected += 1;
    } else {
      recognized.push(obj.key);
    }
  }
  return { count: objects.length, bytes: size, recognized: recognized.length, unlinked, unexpected };
}

export function cleanupPreview({ kind, id, images, privateObjects, publicObjects,
  privateTruncated = false, publicTruncated = false }) {
  const prefix = mediaPrefix(kind, id);
  if (!Array.isArray(images) || !Array.isArray(privateObjects) || !Array.isArray(publicObjects)) {
    throw new Error("Invalid cleanup inventory input");
  }
  const known = new Set();
  const invalidImages = [];
  for (const image of images) {
    if (!image || typeof image.id !== "string" || !IMAGE_ID.test(image.id) ||
        image.storageKey !== `${prefix}${image.id}` || known.has(image.id.toLowerCase())) {
      invalidImages.push(image?.id ?? "unknown");
    } else {
      known.add(image.id.toLowerCase());
    }
  }
  const privateSummary = analyzeBucket(privateObjects, known, prefix, PRIVATE_SUFFIX);
  const publicSummary = analyzeBucket(publicObjects, known, prefix, PUBLIC_SUFFIX);
  const listingComplete = !privateTruncated && !publicTruncated;
  const hasUnexpected = privateSummary.unlinked + publicSummary.unlinked +
    privateSummary.unexpected + publicSummary.unexpected > 0;
  return {
    prefix, imagesInDatabase: images.length, invalidImages,
    privateSummary, publicSummary, listingComplete, hasUnexpected,
    // This is a read-only inventory. No delete authorization is implied.
    readyForDeletion: false,
  };
}

export function humanSize(value) {
  if (!Number.isFinite(value) || value < 0) return "неизвестно";
  if (value < 1024) return `${value} Б`;
  for (const [divider, unit] of [[1024 ** 3, "ГБ"], [1024 ** 2, "МБ"], [1024, "КБ"]]) {
    if (value >= divider) return `${(value / divider).toFixed(2).replace(".", ",")} ${unit}`;
  }
  return `${value} Б`;
}
