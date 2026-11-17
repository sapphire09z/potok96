// Stage 5.13.1: read-only admin history of comments authored by a user.
// All stages of moderation are visible to administrators, not only public posts.
export const ADMIN_USER_COMMENTS_PER_PAGE = 20;
export const ADMIN_USER_COMMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "HIDDEN", "DELETED"];

export function normalizeAdminCommentStatus(input) {
    return typeof input === "string" && ADMIN_USER_COMMENT_STATUSES.includes(input) ? input : "ALL";
}

export function normalizeAdminCommentPage(input) {
    const page = Number(input ?? 1);
    return Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1;
}

export function isPublicNewsCommentVisible(item, now = new Date()) {
    if (item?.status !== "APPROVED" || !item?.post?.commentsEnabled ||
        item.post.status !== "PUBLISHED" || !item.post.publishedAt) return false;
    const publishedAt = new Date(item.post.publishedAt).getTime();
    return Number.isFinite(publishedAt) && publishedAt <= now.getTime();
}
