// Stage 5.12: one publication timestamp serves both scheduled and backdated news.
// Krasnoufimsk and Sverdlovsk oblast use UTC+05:00 year-round.
const OFFSET_MS = 5 * 60 * 60 * 1000;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parseYekatPublicationDate(input) {
    if (typeof input !== "string") return null;
    const match = LOCAL_DATE_TIME.exec(input);
    if (!match) return null;
    const year = Number(match[1]);
    if (year < 2000 || year > 2100) return null;
    const timestamp = Date.parse(`${input}:00+05:00`);
    if (!Number.isFinite(timestamp)) return null;
    const value = new Date(timestamp);
    // Date.parse can normalize invalid calendar days; always round-trip.
    if (yekatDateTimeInput(value) !== input) return null;
    return value;
}

export function yekatDateTimeInput(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime())
        ? new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16) : "";
}

export function publicationDateLabel(value) {
    const local = yekatDateTimeInput(value);
    return local ? `${local.slice(8, 10)}.${local.slice(5, 7)}.${local.slice(0, 4)} ${local.slice(11)} (UTC+5)` : "";
}

export function isNewsScheduled(post, now = new Date()) {
    if (post?.status !== "PUBLISHED" || !post.publishedAt) return false;
    const timestamp = new Date(post.publishedAt).getTime();
    return Number.isFinite(timestamp) && timestamp > now.getTime();
}

export function isNewsPublic(post, now = new Date()) {
    if (post?.status !== "PUBLISHED" || !post.publishedAt) return false;
    const timestamp = new Date(post.publishedAt).getTime();
    return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

export function publicNewsWhere(now = new Date()) {
    return { status: "PUBLISHED", publishedAt: { lte: now } };
}
