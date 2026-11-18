// Stage 5.15.2.3.1 — immutable, read-only deletion-plan snapshot.
// This module must NEVER authorize or perform physical deletion.
import { createHash } from "node:crypto";
import { earliestPurgeDate } from "./contentTrashPolicy.mjs";
import { mediaPrefix } from "./contentCleanupPreview.mjs";

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CUID = /^c[a-z0-9]{10,40}$/;
function dateFromIso(text) {
  if (typeof text !== "string" || !ISO_MS.test(text)) return null;
  const d = new Date(text);
  return Number.isFinite(d.getTime()) && d.toISOString() === text ? d : null;
}

export function parsePurgePlanInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).length !== 3 ||
      !["action", "requestId", "expectedRequestUpdatedAt"].every(k => Object.hasOwn(input, k)) ||
      input.action !== "dry-run" || typeof input.requestId !== "string" ||
      !CUID.test(input.requestId)) return null;
  const requestUpdatedAt = dateFromIso(input.expectedRequestUpdatedAt);
  return requestUpdatedAt ? { requestId: input.requestId, requestUpdatedAt } : null;
}

function objectsForDigest(entries, prefix, bucket, problems) {
  if (!Array.isArray(entries) || entries.length > 1000) {
    problems.push(`Неполный или некорректный список S3 (${bucket}).`);
    return [];
  }
  const out = [];
  const unique = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.key !== "string" || !entry.key.startsWith(prefix) ||
        !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || unique.has(entry.key)) {
      problems.push(`Некорректные или повторяющиеся ключи S3 (${bucket}).`);
      continue;
    }
    unique.add(entry.key);
    const etag = typeof entry.etag === "string" && /^"?[a-zA-Z0-9-]{16,128}"?$/.test(entry.etag)
      ? entry.etag : null;
    if (!etag) problems.push(`Неизвестный ETag объекта S3 (${bucket}); требуется проверка.`);
    out.push({ key: entry.key, bytes: entry.bytes, etag });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key, "en"));
}

export function buildPurgeDryRun({ kind, id, request, item, inventory,
  privateObjects, publicObjects, commentEventCount = 0, commentReportCount = 0,
  now = new Date() }) {
  const prefix = mediaPrefix(kind, id);
  if (!request || request.kind !== kind || request.itemId !== id ||
      !item || typeof item.updatedAt?.toISOString !== "function" ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("Invalid dry-run context");
  }
  const problems = [];
  const samePlacement = item.status === "TRASHED" && item.trashedAt instanceof Date &&
    item.trashedAt.getTime() === request.trashedAt.getTime() && request.status === "PENDING";
  if (!samePlacement) problems.push("Заявка устарела: материал восстановлен, изменён или повторно помещён в корзину.");
  const eligibleAt = earliestPurgeDate(request.trashedAt);
  if (!eligibleAt || eligibleAt > now) problems.push("Не истёк обязательный срок хранения 30 дней.");
  if (!inventory || !inventory.listingComplete) problems.push("Список S3 отсутствует или неполон.");
  if (inventory?.hasUnexpected) problems.push("S3 содержит неизвестные или неучтённые файлы.");
  if ((inventory?.invalidImages?.length ?? 0) > 0) problems.push("Некорректные ключи изображений в PostgreSQL.");
  if (item.cover) problems.push("Существует указанная вручную обложка; её ссылки и происхождение требуют проверки.");
  const commentCount = kind === "news" ? item._count?.comments ?? null : 0;
  const workflowCount = kind === "news" ? item._count?.workflowEvents ?? null : 0;
  if (commentCount === null || workflowCount === null) problems.push("Не удалось определить все зависимости новости.");
  if (commentCount > 0 || workflowCount > 0 || commentEventCount > 0 || commentReportCount > 0) {
    problems.push("Имеются связанные редакционные записи/комментарии: каскадное удаление требует отдельного решения.");
  }
  const manifest = {
    version: 1, kind, id, requestId: request.id,
    trashedAt: request.trashedAt.toISOString(),
    materialUpdatedAt: item.updatedAt.toISOString(),
    requestUpdatedAt: request.updatedAt.toISOString(),
    s3ScanComplete: Boolean(inventory?.listingComplete),
    s3HasUnexpected: Boolean(inventory?.hasUnexpected),
    invalidImageIds: [...(inventory?.invalidImages ?? [])].sort(),
    imageBindings: (item.images ?? []).map(x => ({ id: x.id, storageKey: x.storageKey }))
      .sort((a, b) => a.id.localeCompare(b.id, "en")),
    commentCount, workflowCount, commentEventCount, commentReportCount,
    manualCoverPresent: Boolean(item.cover),
    private: objectsForDigest(privateObjects, prefix, "private", problems),
    public: objectsForDigest(publicObjects, prefix, "public", problems),
  };
  // These are ALWAYS unresolved in this patch — no approval or execution API exists.
  problems.push("Резервная копия PostgreSQL и архив S3 не подтверждены.");
  problems.push("Внешние ссылки и сроки хранения данных не проверены.");
  const digest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  const status = !samePlacement ? "STALE" :
    !eligibleAt || eligibleAt > now ? "WAITING" : "BLOCKED";
  return {
    status, digest,
    report: {
      mode: "DRY_RUN", checkedAt: now.toISOString(), eligibleAt: eligibleAt?.toISOString() ?? null,
      status, deletionAllowed: false, issues: [...new Set(problems)],
      imageCount: item.images?.length ?? 0, commentCount, workflowCount,
      commentEventCount, commentReportCount,
      privateCount: manifest.private.length, publicCount: manifest.public.length,
      privateBytes: manifest.private.reduce((sum, x) => sum + x.bytes, 0),
      publicBytes: manifest.public.reduce((sum, x) => sum + x.bytes, 0),
      s3Complete: Boolean(inventory?.listingComplete),
      // Keep this immutable inventory to compare with a fresh listing before any later execution.
      manifest,
    },
  };
}
