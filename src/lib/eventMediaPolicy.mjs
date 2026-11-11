// Dependency-free media rules shared by API handlers and node:test.
export const EVENT_IMAGE_LIMIT = 8;
export const EVENT_IMAGE_SIZES = Object.freeze([320, 640, 960, 1440]);
export const EVENT_IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EVENT_MEDIA_OWNER = /^c[a-z0-9]{10,40}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

export function eventImageKey(eventId, image) {
    if (!EVENT_MEDIA_OWNER.test(eventId) || !image || !EVENT_IMAGE_ID.test(image.id))
        throw new Error("Некорректный идентификатор афиши.");
    const key = `media/events/${eventId}/${image.id}`;
    if (image.storageKey !== key) throw new Error("Некорректный ключ афиши в S3.");
    return key;
}

function clean(value, max) {
    if (typeof value !== "string" || value.length > max * 3) return null;
    const text = value.normalize("NFC").trim();
    return text.length > max || CONTROL.test(text) || /[\r\n]/.test(text) ? null : text;
}

export function eventImageMetadata(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).length !== 4 ||
        !["action", "caption", "credit", "rightsNote"].every(key => Object.hasOwn(input, key)) ||
        input.action !== "metadata") return null;
    const caption = clean(input.caption, 240);
    const credit = clean(input.credit, 240);
    const rightsNote = clean(input.rightsNote, 1000);
    return caption === null || credit === null || rightsNote === null ? null : {
        caption: caption || null, credit: credit || null, rightsNote: rightsNote || null,
    };
}

export function canDisplayEventImage(event, image) {
    return Boolean(event && image && image.eventId === event.id &&
        eventImageKeySafe(event.id, image) &&
        typeof image.credit === "string" && image.credit.trim() &&
        typeof image.rightsNote === "string" && image.rightsNote.trim());
}

function eventImageKeySafe(eventId, image) {
    try { eventImageKey(eventId, image); return true; }
    catch { return false; }
}
