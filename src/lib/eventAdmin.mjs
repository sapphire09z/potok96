import { EVENT_CATEGORIES } from "./eventCategories.js";

export const EVENT_ID = /^c[a-z0-9]{10,40}$/;
export const EVENT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const EVENT_FIELDS = Object.freeze([
    "title", "slug", "category", "startAt", "endAt", "location", "price",
    "isFree", "pushkinCard", "pushkinProofUrl", "summary", "cover", "orgSlug", "video", "content",
]);
const CATEGORIES = new Set(EVENT_CATEGORIES.map(item => item.id));
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const HOURS = 5 * 60 * 60 * 1000;

function plain(value, max, required = false, multiline = false) {
    if (typeof value !== "string" || value.length > max * 3) return null;
    const cleaned = value.normalize("NFC").trim();
    if (cleaned.length > max || (required && !cleaned) || CONTROL.test(cleaned) ||
        (!multiline && /[\r\n]/.test(cleaned))) return null;
    return cleaned;
}

// The editor always uses Krasnoufimsk/Yekaterinburg civil time (UTC+05:00),
// regardless of the browser and VPS time zones. Strict round-trip rejects invalid dates.
export function localEventTime(value, required = false) {
    if (value === "" && !required) return null;
    if (typeof value !== "string" || !LOCAL.test(value)) return undefined;
    const year = Number(value.slice(0, 4));
    if (year < 2000 || year > 2100) return undefined;
    const date = new Date(`${value}:00+05:00`);
    if (!Number.isFinite(date.getTime())) return undefined;
    return toEventLocalTime(date) === value ? date : undefined;
}

export function toEventLocalTime(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime())
        ? new Date(date.getTime() + HOURS).toISOString().slice(0, 16) : "";
}

export function isEventVersion(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function httpsUrl(value) {
    const v = plain(value, 2048);
    if (v === null || !v) return v;
    try {
        const url = new URL(v);
        return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

function embedUrl(value) {
    const urlText = httpsUrl(value);
    if (!urlText) return urlText;
    const url = new URL(urlText);
    // No arbitrary third-party iframe URLs or URL-embedded credentials.
    const youtube = url.hostname === "www.youtube-nocookie.com" && /^\/embed\/[a-zA-Z0-9_-]{11}$/.test(url.pathname);
    const rutube = url.hostname === "rutube.ru" && /^\/play\/embed\/[a-zA-Z0-9_-]{5,64}\/?$/.test(url.pathname);
    return (youtube || rutube) && !url.search && !url.hash ? url.href : null;
}

export function validateEventFields(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).length !== EVENT_FIELDS.length ||
        Object.keys(value).some(key => !EVENT_FIELDS.includes(key))) return null;
    if (typeof value.isFree !== "boolean" || typeof value.pushkinCard !== "boolean") return null;
    const data = {
        title: plain(value.title, 180, true),
        slug: plain(value.slug, 160, true),
        category: plain(value.category, 32, true),
        startAt: localEventTime(value.startAt, true),
        endAt: localEventTime(value.endAt),
        location: plain(value.location, 240),
        price: plain(value.price, 80),
        isFree: value.isFree,
        pushkinCard: value.pushkinCard,
        pushkinProofUrl: httpsUrl(value.pushkinProofUrl),
        summary: plain(value.summary, 600),
        cover: plain(value.cover, 512),
        orgSlug: plain(value.orgSlug, 160),
        video: embedUrl(value.video),
        content: plain(value.content, 30000, false, true),
    };
    if (Object.entries(data).some(([key, item]) => item === undefined || (item === null && key !== "endAt")) ||
        data.startAt === undefined || data.endAt === undefined ||
        !EVENT_SLUG.test(data.slug || "") || data.slug.length < 3 ||
        !CATEGORIES.has(data.category) ||
        (data.endAt && data.endAt < data.startAt) ||
        (data.isFree && (data.price || data.pushkinCard)) ||
        (data.pushkinCard && !data.pushkinProofUrl) ||
        (data.cover && !/^\/media\/events\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp|avif)$/i.test(data.cover)) ||
        (data.orgSlug && !EVENT_SLUG.test(data.orgSlug))) return null;
    return data;
}

export function eventToPublic(row) {
    return {
        slug: row.slug, title: row.title, category: row.category,
        startAt: row.startAt.toISOString(), endAt: row.endAt?.toISOString() ?? null,
        location: row.location, price: row.isFree ? "" : row.price,
        isFree: row.isFree, pushkinCard: row.pushkinCard,
        summary: row.summary, cover: row.cover, org: row.orgSlug || null,
        video: row.video, content: row.content, status: "published",
    };
}
