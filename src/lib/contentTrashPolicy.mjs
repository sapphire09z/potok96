// Stage 5.15.1: reversible editorial trash, without any destructive side effects.
export const CONTENT_TRASH_KINDS = Object.freeze(["news", "events"]);
export const CONTENT_TRASH_DAYS = 30;

export function canMoveToTrash(kind, status) {
    if (!CONTENT_TRASH_KINDS.includes(kind)) return false;
    return kind === "news" ? ["DRAFT", "REVIEW", "APPROVED", "UNPUBLISHED"].includes(status)
        : status === "DRAFT";
}

export function canRestoreFromTrash(kind, status) {
    return CONTENT_TRASH_KINDS.includes(kind) && status === "TRASHED";
}

// Display only: stage 5.15.1 does not schedule or run permanent removal.
export function earliestPurgeDate(trashedAt) {
    const ms = new Date(trashedAt).getTime();
    return Number.isFinite(ms) ? new Date(ms + CONTENT_TRASH_DAYS * 86400000) : null;
}

export function parseContentTrashInput(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!Object.keys(value).every(key => ["action", "expectedUpdatedAt", "reason"].includes(key))) return null;
    if (!["trash", "restore"].includes(value.action)) return null;
    if (typeof value.expectedUpdatedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.expectedUpdatedAt)) return null;
    const version = new Date(value.expectedUpdatedAt);
    if (!Number.isFinite(version.getTime()) || version.toISOString() !== value.expectedUpdatedAt) return null;
    const reason = value.reason === undefined ? "" : value.reason;
    if (typeof reason !== "string") return null;
    const trimmed = reason.trim();
    if (trimmed.length > 500 || (value.action === "trash" && trimmed.length < 5)) return null;
    return { action: value.action, version, reason: trimmed };
}
