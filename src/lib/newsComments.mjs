// Stage 5.13. Public comments are available only for published, due CMS stories.
// All user submissions start in PENDING, even replies from staff accounts.
export const COMMENT_MAX_LENGTH = 1000;
export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_COOLDOWN_MS = 30_000;
export const COMMENT_DAILY_LIMIT = 20;
export const COMMENT_PENDING_LIMIT = 5;
export const COMMENT_ROOT_LIMIT = 50;

const CONTROL = /[\p{Cc}\p{Cf}]/u;
export function normalizeCommentText(value) {
    if (typeof value !== "string") return null;
    const cleaned = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
    // Newlines are supported, but no invisible controls or markup rendering.
    const withoutNewlines = cleaned.replace(/\n/g, "");
    if (cleaned.length < COMMENT_MIN_LENGTH || cleaned.length > COMMENT_MAX_LENGTH ||
        CONTROL.test(withoutNewlines)) return null;
    return cleaned;
}

export function canReceiveNewsComments(post, now = new Date()) {
    if (!post || !post.commentsEnabled || post.status !== "PUBLISHED" || !post.publishedAt) return false;
    const at = new Date(post.publishedAt).getTime();
    return Number.isFinite(at) && at <= now.getTime();
}

export function isValidCommentParent(parent, postId) {
    return !!parent && parent.postId === postId && parent.parentId === null && parent.status === "APPROVED";
}

export function nextModerationStatus(status, action) {
    if (action === "approve" && ["PENDING", "HIDDEN", "REJECTED"].includes(status)) return "APPROVED";
    if (action === "reject" && status === "PENDING") return "REJECTED";
    if (action === "hide" && status === "APPROVED") return "HIDDEN";
    return null;
}

export function commentAuthorLabel(name) {
    return typeof name === "string" && name.trim() ? name.trim() : "Читатель";
}
