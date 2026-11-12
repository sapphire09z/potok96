// Zero-dependency shared policy for administrative official notices.
export const NOTICE_ID = /^c[a-z0-9]{10,40}$/;
export const NOTICE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const NOTICE_FIELDS = Object.freeze([
    "slug", "title", "date", "issuer", "locality", "summary", "sourceUrl", "content",
]);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

function plain(value, limit, required = false, multiline = false) {
    if (typeof value !== "string" || value.length > limit * 3) return null;
    const text = value.normalize("NFC").trim();
    if (text.length > limit || (required && !text) || CONTROL.test(text) ||
        (!multiline && /[\r\n]/.test(text))) return null;
    return text;
}

export function validNoticeDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const year = Number(value.slice(0, 4));
    if (year < 1900 || year > 2100) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function sourceUrl(value) {
    const raw = plain(value, 2048);
    if (raw === null || !raw) return raw;
    try {
        const url = new URL(raw);
        return url.protocol === "https:" && url.hostname && !url.username && !url.password
            ? url.href : null;
    } catch { return null; }
}

export function validNoticeVersion(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))
        return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export function validateOfficialNotice(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).length !== NOTICE_FIELDS.length ||
        Object.keys(value).some(key => !NOTICE_FIELDS.includes(key))) return null;
    const data = {
        slug: plain(value.slug, 160, true),
        title: plain(value.title, 200, true),
        date: plain(value.date, 10, true),
        issuer: plain(value.issuer, 240, true),
        locality: plain(value.locality, 200),
        summary: plain(value.summary, 600),
        sourceUrl: sourceUrl(value.sourceUrl),
        content: plain(value.content, 30000, true, true),
    };
    if (Object.values(data).some(v => v === null) ||
        !NOTICE_SLUG.test(data.slug) || data.slug.length < 3 || !validNoticeDate(data.date))
        return null;
    return data;
}
