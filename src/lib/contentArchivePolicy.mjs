// Stage 5.15.2.3.2 — validation for an offline backup, NEVER purge permission.
import { createHash } from "node:crypto";

const CUID = /^c[a-z0-9]{10,40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_FILES_PER_BUCKET = 1000;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;

export function validPlanId(value) { return typeof value === "string" && CUID.test(value); }
export function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
export function equalEtags(a, b) {
  return typeof a === "string" && typeof b === "string" &&
    /^"?[a-zA-Z0-9-]{16,128}"?$/.test(a) &&
    a.replace(/^"|"$/g, "") === b.replace(/^"|"$/g, "");
}

// PostgreSQL JSONB reorders object keys. Reconstruct the exact field ordering
// used by buildPurgeDryRun() before comparing to its historical SHA-256.
export function planDigestFromJsonb(m) {
  if (!m || !Array.isArray(m.invalidImageIds) || !Array.isArray(m.imageBindings) ||
      !Array.isArray(m.private) || !Array.isArray(m.public))
    throw new Error("Некорректный исторический манифест Dry Run.");
  const ordered = {
    version: m.version, kind: m.kind, id: m.id, requestId: m.requestId,
    trashedAt: m.trashedAt, materialUpdatedAt: m.materialUpdatedAt,
    requestUpdatedAt: m.requestUpdatedAt,
    s3ScanComplete: m.s3ScanComplete, s3HasUnexpected: m.s3HasUnexpected,
    invalidImageIds: m.invalidImageIds,
    imageBindings: m.imageBindings.map(x => ({ id: x.id, storageKey: x.storageKey })),
    commentCount: m.commentCount, workflowCount: m.workflowCount,
    commentEventCount: m.commentEventCount, commentReportCount: m.commentReportCount,
    manualCoverPresent: m.manualCoverPresent,
    private: m.private.map(x => ({ key: x.key, bytes: x.bytes, etag: x.etag })),
    public: m.public.map(x => ({ key: x.key, bytes: x.bytes, etag: x.etag })),
  };
  return sha256(JSON.stringify(ordered));
}

export function validateArchivedPlan({ plan, request, material }) {
  if (!plan || !request || !material || !validPlanId(plan.id) || !validPlanId(request.id))
    throw new Error("План, заявка или материал не найдены.");
  if (!SHA256.test(plan.digest) || !plan.report?.manifest ||
      planDigestFromJsonb(plan.report.manifest) !== plan.digest)
    throw new Error("SHA-256 плана не соответствует сохранённому манифесту.");
  const m = plan.report.manifest;
  if (m.version !== 1 || !["news", "events"].includes(plan.kind) ||
      !(["WAITING", "BLOCKED"].includes(plan.status)) || plan.kind !== m.kind || plan.itemId !== m.id || plan.requestId !== request.id ||
      request.kind !== plan.kind || request.itemId !== plan.itemId ||
      request.status !== "PENDING" || material.status !== "TRASHED" ||
      request.trashedAt.toISOString() !== m.trashedAt ||
      material.trashedAt?.toISOString() !== m.trashedAt ||
      material.updatedAt.toISOString() !== m.materialUpdatedAt ||
      request.updatedAt.toISOString() !== m.requestUpdatedAt ||
      plan.trashedAt.toISOString() !== m.trashedAt ||
      plan.materialUpdatedAt.toISOString() !== m.materialUpdatedAt ||
      plan.requestUpdatedAt.toISOString() !== m.requestUpdatedAt ||
      plan.digest !== planDigestFromJsonb(m))
    throw new Error("Заявка, материал или план изменились после Dry Run.");
  if (!m.s3ScanComplete || m.s3HasUnexpected || m.invalidImageIds?.length ||
      !Array.isArray(m.private) || !Array.isArray(m.public) ||
      m.private.length > MAX_FILES_PER_BUCKET || m.public.length > MAX_FILES_PER_BUCKET)
    throw new Error("Dry Run содержит неполный или подозрительный список S3.");
  const prefix = `media/${plan.kind}/${plan.itemId}/`;
  let totalBytes = 0;
  for (const bucket of ["private", "public"]) {
    const names = new Set();
    for (const f of m[bucket]) {
      if (!f || typeof f.key !== "string" || !f.key.startsWith(prefix) ||
          !/^media\/(news|events)\/c[a-z0-9]{10,40}\/[0-9a-f-]{36}\/(?:original\.(?:jpg|png|webp)|(?:320|640|960|1440)\.webp)$/i.test(f.key) ||
          names.has(f.key) || !Number.isSafeInteger(f.bytes) || f.bytes < 0 ||
          f.bytes > MAX_FILE_BYTES || !equalEtags(f.etag, f.etag))
        throw new Error(`Некорректный объект в манифесте S3 (${bucket}).`);
      totalBytes += f.bytes;
      names.add(f.key);
    }
  }
  if (totalBytes > MAX_ARCHIVE_BYTES) throw new Error("Слишком большой объём архива S3.");
  return { manifest: m, prefix, totalBytes };
}

export function compareListing(expected, actual, bucket) {
  if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length)
    throw new Error(`Перечень S3 ${bucket} изменился после Dry Run.`);
  const actualMap = new Map();
  for (const f of actual) {
    if (!f || typeof f.key !== "string" || actualMap.has(f.key))
      throw new Error(`Неоднозначный перечень S3 ${bucket}.`);
    actualMap.set(f.key, f);
  }
  for (const f of expected) {
    const latest = actualMap.get(f.key);
    if (!latest || latest.bytes !== f.bytes || !equalEtags(latest.etag, f.etag))
      throw new Error(`Объект S3 ${bucket} изменился после Dry Run.`);
  }
  return true;
}

export function safeFileName(bucket, index) {
  if (!["private", "public"].includes(bucket) || !Number.isSafeInteger(index) ||
      index < 0 || index >= MAX_FILES_PER_BUCKET) throw new Error("Некорректный путь архива.");
  return `objects/${bucket}/${String(index + 1).padStart(4, "0")}.bin`;
}

export function verifyArchiveIndex(index) {
  if (!index || index.format !== "potok96-content-backup-v1" ||
      !validPlanId(index.planId) || !SHA256.test(index.planDigest) ||
      !index.database || index.database.path !== "database.dump" ||
      !SHA256.test(index.database.sha256) || !Number.isSafeInteger(index.database.bytes) ||
      index.database.bytes <= 0 || !Array.isArray(index.files) || index.files.length > 2000 ||
      index.deletionAllowed !== false) throw new Error("Некорректный индекс архива.");
  const unique = new Set();
  for (const f of index.files) {
    if (!f || !["private", "public"].includes(f.bucket) ||
        !/^objects\/(private|public)\/\d{4}\.bin$/.test(f.path) ||
        !f.path.startsWith(`objects/${f.bucket}/`) || !SHA256.test(f.sha256) ||
        !Number.isSafeInteger(f.bytes) || f.bytes < 0 || f.bytes > MAX_FILE_BYTES ||
        typeof f.key !== "string" || unique.has(f.path))
      throw new Error("Небезопасный индекс объекта архива.");
    unique.add(f.path);
  }
  return true;
}
