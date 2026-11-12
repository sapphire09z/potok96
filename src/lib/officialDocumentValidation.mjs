// Stage 5.9.2: zero-dependency request policy, testable with node --test.
import { validNoticeDate, validNoticeVersion } from "./officialNoticeValidation.mjs";

export const DOCUMENT_ID = /^c[a-z0-9]{10,40}$/;
export const DOCUMENT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DOCUMENT_FIELDS = Object.freeze([
    "slug", "title", "type", "number", "date", "issuer", "description", "sourceUrl",
]);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

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
        return url.protocol === "https:" && !!url.hostname && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}
export { validNoticeVersion as validDocumentVersion };
export function validateOfficialDocument(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).length !== DOCUMENT_FIELDS.length ||
        Object.keys(value).some(key => !DOCUMENT_FIELDS.includes(key))) return null;
    const data = {
        slug: plain(value.slug, 160, true),
        title: plain(value.title, 300, true),
        type: plain(value.type, 100, true),
        number: plain(value.number, 100),
        date: plain(value.date, 10, true),
        issuer: plain(value.issuer, 240, true),
        description: plain(value.description, 10000, false, true),
        sourceUrl: httpsUrl(value.sourceUrl),
    };
    if (Object.values(data).some(v => v === null) ||
        !DOCUMENT_SLUG.test(data.slug) || data.slug.length < 3 || !validNoticeDate(data.date)) return null;
    return data;
}
export const PDF_MAX_BYTES = 15 * 1024 * 1024;
export function isValidPdf(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 20 || bytes.length > PDF_MAX_BYTES) return false;
    const header = Buffer.from(bytes.subarray(0, 8)).toString("ascii");
    if (!/^%PDF-(?:1\.[0-7]|2\.0)$/.test(header)) return false;
    // This is a cheap consistency check, not a malware/structural PDF validator.
    const trailer = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 2048))).toString("latin1");
    return trailer.includes("%%EOF");
}
export function validPdfUploadFile(file) {
    return file && typeof file.arrayBuffer === "function" &&
        Number.isInteger(file.size) && file.size > 0 && file.size <= PDF_MAX_BYTES &&
        typeof file.name === "string" && /\.pdf$/i.test(file.name) &&
        ["application/pdf", "application/octet-stream", ""].includes(file.type);
}
