// Manual deletion only. No scheduled jobs, no global bucket cleanup.
const VERSION = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ORG_ID = /^c[a-z0-9]{10,40}$/;
const AD_ID = /^[a-zA-Z0-9_-]{8,80}$/;

export function parseResourceDeleteInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).length !== 2 || input.action !== "delete" ||
      typeof input.expectedUpdatedAt !== "string" || !VERSION.test(input.expectedUpdatedAt)) return null;
  const date = new Date(input.expectedUpdatedAt);
  return Number.isFinite(date.getTime()) && date.toISOString() === input.expectedUpdatedAt
    ? { version: date } : null;
}

export function deletionPrefixes(kind, id) {
  if (kind === "orgs" && ORG_ID.test(id)) {
    return { private: `media/orgs/${id}/`, public: `media/orgs/${id}/` };
  }
  if (kind === "ads" && AD_ID.test(id)) {
    return { private: `media/ads/${id}/`, public: `media/listings/${id}/` };
  }
  throw new Error("Invalid deletion scope");
}

// Accept only keys inside the single record's own prefix, never a common folder.
export function scopedKeys(prefix, listing) {
  if (!listing || listing.truncated || !Array.isArray(listing.objects) || listing.objects.length > 1000)
    throw new Error("Неполный список файлов S3.");
  const seen = new Set();
  for (const obj of listing.objects) {
    if (!obj || typeof obj.key !== "string" || !obj.key.startsWith(prefix) ||
        obj.key.length <= prefix.length || obj.key.length > 1024 || seen.has(obj.key) ||
        !Number.isSafeInteger(obj.bytes) || obj.bytes < 0)
      throw new Error("Некорректный ключ S3.");
    seen.add(obj.key);
  }
  return [...seen];
}
