// 5.15.3: manual ADMIN-only permanent delete helpers. Never schedules deletion.
import { mediaPrefix } from "./contentCleanupPreview.mjs";

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function parsePermanentDeleteInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).length !== 2 || input.action !== "delete" ||
      typeof input.expectedUpdatedAt !== "string" ||
      !ISO_MS.test(input.expectedUpdatedAt)) return null;
  const version = new Date(input.expectedUpdatedAt);
  return Number.isFinite(version.getTime()) &&
    version.toISOString() === input.expectedUpdatedAt ? { version } : null;
}

// The record owns exactly this prefix in each bucket. Orphaned variants
// inside it are also deleted; objects outside it cannot be targeted.
export function assertOwnedInventory(kind, id, privateListing, publicListing) {
  const prefix = mediaPrefix(kind, id);
  const out = { private: [], public: [] };
  for (const [bucket, listing] of [["private", privateListing], ["public", publicListing]]) {
    if (!listing || listing.truncated || !Array.isArray(listing.objects) ||
        listing.objects.length > 1000) throw new Error(`Incomplete S3 listing: ${bucket}`);
    const keys = new Set();
    for (const obj of listing.objects) {
      if (!obj || typeof obj.key !== "string" || !obj.key.startsWith(prefix) ||
          obj.key.length <= prefix.length || obj.key.length > 1024 ||
          keys.has(obj.key) || !Number.isSafeInteger(obj.bytes) || obj.bytes < 0)
        throw new Error(`Unexpected S3 key: ${bucket}`);
      keys.add(obj.key);
      out[bucket].push(obj.key);
    }
  }
  return out;
}
