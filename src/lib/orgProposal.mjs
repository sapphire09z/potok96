import { ORG_CATEGORIES } from "./orgCategories.js";

export const ORG_ID = /^c[a-z0-9]{10,40}$/;
export const PROPOSAL_FIELDS = Object.freeze([
    "title", "type", "category", "area", "locality", "address", "phone", "hours",
    "tags", "services", "website", "email", "mapUrl", "vkUrl", "okUrl", "maxUrl", "content",
]);
const CATEGORIES = new Set(ORG_CATEGORIES.map(item => item.id));
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isIsoVersion(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) && d.toISOString() === value;
}

function text(value, max, { required = false, multiline = false } = {}) {
    if (typeof value !== "string" || value.length > max * 3) return null;
    const clean = value.normalize("NFC").trim();
    if (clean.length > max || (required && !clean) || CONTROL.test(clean)) return null;
    if (!multiline && /[\r\n]/.test(clean)) return null;
    return clean;
}

function secureUrl(value) {
    const v = text(value, 2048);
    if (v === null || !v) return v;
    try {
        const u = new URL(v);
        return u.protocol === "https:" && u.hostname && !u.username && !u.password ? u.href : null;
    } catch { return null; }
}

function items(value, count, max) {
    if (!Array.isArray(value) || value.length > count) return null;
    const result = value.map(item => text(item, max, { required: true }));
    return result.some(item => item === null) ? null : [...new Set(result)];
}

export function snapshotOrgFields(row) {
    return Object.fromEntries(PROPOSAL_FIELDS.map(key => [key, row[key]]));
}

export function validateOrgProposalFields(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).length !== PROPOSAL_FIELDS.length ||
        Object.keys(value).some(key => !PROPOSAL_FIELDS.includes(key))) return null;
    const result = {
        title: text(value.title, 160, { required: true }),
        type: text(value.type, 120),
        category: text(value.category, 32, { required: true }),
        area: text(value.area, 12, { required: true }),
        locality: text(value.locality, 120),
        address: text(value.address, 240),
        phone: text(value.phone, 100),
        hours: text(value.hours, 600, { multiline: true }),
        tags: items(value.tags, 16, 40),
        services: items(value.services, 24, 120),
        website: secureUrl(value.website),
        email: text(value.email, 254),
        mapUrl: secureUrl(value.mapUrl),
        vkUrl: secureUrl(value.vkUrl),
        okUrl: secureUrl(value.okUrl),
        maxUrl: secureUrl(value.maxUrl),
        content: text(value.content, 12000, { multiline: true }),
    };
    if (Object.values(result).some(item => item === null) || !CATEGORIES.has(result.category) ||
        !["city", "district"].includes(result.area) ||
        (result.email && !EMAIL.test(result.email))) return null;
    return result;
}

export function canEditOrgProposal({ claim, org, actor }) {
    return Boolean(actor && !actor.archivedAt && org?.status === "PUBLISHED" &&
        claim?.status === "APPROVED" && claim.requesterId === actor.id && claim.orgId === org.id);
}

export function sameProposalFields(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}
