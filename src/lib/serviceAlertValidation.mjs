// Stage 5.9.3. All times entered in the UI are local to Krasnoufimsk (UTC+05:00).
export const ALERT_ID = /^c[a-z0-9]{10,40}$/;
export const ALERT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ALERT_FIELDS = Object.freeze([
    "slug", "title", "service", "state", "urgency", "confirmed", "startAt",
    "expectedEndAt", "restoredAt", "addresses", "source", "sourceUrl", "content",
]);
export const ALERT_SERVICES = Object.freeze(["water", "electricity", "gas", "heating", "other"]);
export const ALERT_STATES = Object.freeze(["planned", "active", "restored"]);
export const ALERT_URGENCIES = Object.freeze(["normal", "urgent"]);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const YEKATERINBURG_OFFSET_MS = 5 * 60 * 60 * 1000;

function plain(value, limit, required = false, multiline = false) {
    if (typeof value !== "string" || value.length > limit * 3) return null;
    const text = value.normalize("NFC").trim();
    if (text.length > limit || (required && !text) || CONTROL.test(text) ||
        (!multiline && /[\r\n]/.test(text))) return null;
    return text;
}
function httpsUrl(value) {
    const raw = plain(value, 2048);
    if (raw === null || !raw) return raw;
    try {
        const url = new URL(raw);
        return url.protocol === "https:" && url.hostname && !url.username && !url.password
            ? url.href : null;
    } catch { return null; }
}
export function validAlertVersion(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))
        return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
}
export function parseYekaterinburgDateTime(value, optional = false) {
    if (optional && value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
        return undefined;
    const year = Number(value.slice(0, 4));
    if (year < 2000 || year > 2100) return undefined;
    const date = new Date(`${value}:00+05:00`);
    if (!Number.isFinite(date.getTime()) || toYekaterinburgInput(date) !== value)
        return undefined;
    return date;
}
export function toYekaterinburgInput(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() + YEKATERINBURG_OFFSET_MS).toISOString().slice(0, 16);
}
export function validateServiceAlert(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).length !== ALERT_FIELDS.length ||
        Object.keys(value).some(key => !ALERT_FIELDS.includes(key)) ||
        typeof value.confirmed !== "boolean") return null;
    const data = {
        slug: plain(value.slug, 160, true),
        title: plain(value.title, 200, true),
        service: value.service,
        state: value.state,
        urgency: value.urgency,
        confirmed: value.confirmed,
        startAt: parseYekaterinburgDateTime(value.startAt),
        expectedEndAt: parseYekaterinburgDateTime(value.expectedEndAt, true),
        restoredAt: parseYekaterinburgDateTime(value.restoredAt, true),
        addresses: plain(value.addresses, 1000),
        source: plain(value.source, 240),
        sourceUrl: httpsUrl(value.sourceUrl),
        content: plain(value.content, 20000, false, true),
    };
    if (["slug", "title", "addresses", "source", "sourceUrl", "content"].some(k => data[k] === null) ||
        Object.values(data).includes(undefined) ||
        !ALERT_SLUG.test(data.slug) || data.slug.length < 3 ||
        !ALERT_SERVICES.includes(data.service) || !ALERT_STATES.includes(data.state) ||
        !ALERT_URGENCIES.includes(data.urgency) ||
        (data.expectedEndAt && data.expectedEndAt < data.startAt) ||
        (data.restoredAt && data.restoredAt < data.startAt) ||
        (data.state !== "restored" && data.restoredAt)) return null;
    return data;
}
export function isServiceAlertPublicationReady(value) {
    return Boolean(value && value.confirmed === true &&
        typeof value.title === "string" && value.title.trim() &&
        typeof value.source === "string" && value.source.trim() &&
        ALERT_SERVICES.includes(value.service) && ALERT_STATES.includes(value.state) &&
        ALERT_URGENCIES.includes(value.urgency) && value.startAt instanceof Date &&
        Number.isFinite(value.startAt.getTime()) &&
        (value.state !== "restored" || (value.restoredAt instanceof Date &&
            Number.isFinite(value.restoredAt.getTime()) && value.restoredAt >= value.startAt)));
}
