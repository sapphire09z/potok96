// Stage 5.15.2.2: no execution capability. All requests are administrative plans.
import { earliestPurgeDate } from "./contentTrashPolicy.mjs";

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ID = /^c[a-z0-9]{10,40}$/;

function parseIso(value) {
  if (typeof value !== "string" || !ISO_MS.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? date : null;
}

export function parsePurgeAction(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (!Object.keys(input).every(key => ["action", "expectedUpdatedAt", "expectedTrashedAt", "requestId", "expectedRequestUpdatedAt", "reason"].includes(key))) return null;
  if (!["request", "check", "cancel"].includes(input.action)) return null;
  if (input.action === "request") {
    if (Object.keys(input).some(key => !["action", "expectedUpdatedAt", "expectedTrashedAt", "reason"].includes(key))) return null;
    const updatedAt = parseIso(input.expectedUpdatedAt);
    const trashedAt = parseIso(input.expectedTrashedAt);
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (!updatedAt || !trashedAt || reason.length < 10 || reason.length > 500) return null;
    return { action: "request", updatedAt, trashedAt, reason };
  }
  if (Object.keys(input).some(key => !["action", "requestId", "expectedRequestUpdatedAt"].includes(key))) return null;
  if (typeof input.requestId !== "string" || !ID.test(input.requestId)) return null;
  const requestUpdatedAt = parseIso(input.expectedRequestUpdatedAt);
  return requestUpdatedAt ? { action: input.action, requestId: input.requestId, requestUpdatedAt } : null;
}

export function purgePreflightReport({ item, request, inventory, now = new Date() }) {
  const issues = [];
  if (!item || item.status !== "TRASHED" || !item.trashedAt ||
    !request || item.trashedAt.getTime() !== request.trashedAt.getTime()) {
    issues.push("Материал восстановлен либо с момента создания заявки помещён в корзину повторно.");
  }
  const deadline = request ? earliestPurgeDate(request.trashedAt) : null;
  if (!deadline || deadline > now) issues.push("Срок 30 дней ещё не истёк.");
  if (!inventory) issues.push("Инвентаризация S3 недоступна.");
  else {
    if (!inventory.listingComplete) issues.push("Список S3 неполный.");
    if (inventory.hasUnexpected) issues.push("Найдены неопознанные либо неучтённые файлы S3.");
    if (inventory.invalidImages.length > 0) issues.push("Некорректные ключи изображений в PostgreSQL.");
  }
  // These are genuine remaining checks, not a green light for destruction.
  issues.push("Не подтверждены внешние ссылки, лицензии, сроки хранения и проверенный резервный архив.");
  return {
    outcome: !item || item.status !== "TRASHED" || !request || !item.trashedAt ||
        item.trashedAt.getTime() !== request.trashedAt.getTime() ? "STALE" :
      !deadline || deadline > now ? "WAITING" :
      !inventory || !inventory.listingComplete || inventory.hasUnexpected || inventory.invalidImages.length ? "BLOCKED" : "REVIEW",
    issues,
    checkedAt: now.toISOString(),
    eligibleAt: deadline?.toISOString() ?? null,
    imageCount: item?.images?.length ?? 0,
    commentCount: item?._count?.comments ?? 0,
    workflowCount: item?._count?.workflowEvents ?? 0,
    privateCount: inventory?.privateSummary.count ?? null,
    privateBytes: inventory?.privateSummary.bytes ?? null,
    publicCount: inventory?.publicSummary.count ?? null,
    publicBytes: inventory?.publicSummary.bytes ?? null,
    s3Complete: inventory?.listingComplete ?? false,
    // Never return an affirmative authorization to execute a purge.
    deletionAllowed: false,
  };
}
