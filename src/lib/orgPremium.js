import { isExtendedPlacement } from "./orgPlacement.js";

const LIMITS = {
    priceItems: { count: 16, fields: { title: 120, price: 80, description: 240 }, required: ["title", "price"] },
    specialOffers: { count: 3, fields: { title: 120, description: 400 }, required: ["title", "description"] },
    extraLinks: { count: 3, fields: { label: 50, url: 2048 }, required: ["label", "url"] },
};

function normalizeList(items, settings) {
    if (!Array.isArray(items) || items.length > settings.count) return null;
    const allowed = Object.keys(settings.fields);
    const result = [];
    for (const item of items) {
        if (!item || typeof item !== "object" || Array.isArray(item) ||
            Object.keys(item).some(key => !allowed.includes(key))) return null;
        const entry = {};
        for (const [field, maxLength] of Object.entries(settings.fields)) {
            if (typeof item[field] !== "string" || item[field].length > maxLength) return null;
            entry[field] = item[field].trim();
            if (settings.required.includes(field) && !entry[field]) return null;
        }
        if ("url" in entry) {
            try {
                const url = new URL(entry.url);
                if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
                entry.url = url.href;
            } catch { return null; }
        }
        result.push(entry);
    }
    return result;
}

export function validateOrgPremium(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(key => !Object.hasOwn(LIMITS, key))) return null;
    const normalized = {};
    for (const [key, settings] of Object.entries(LIMITS)) {
        normalized[key] = normalizeList(input[key], settings);
        if (normalized[key] === null) return null;
    }
    return normalized;
}

// Never expose paid data if the placement has expired, even when a published
// organization still has these values stored in PostgreSQL.
export function publicOrgPremium(row, now = new Date()) {
    const empty = { priceItems: [], specialOffers: [], extraLinks: [] };
    if (!isExtendedPlacement(row, now)) return empty;
    const validated = validateOrgPremium({
        priceItems: row.priceItems,
        specialOffers: row.specialOffers,
        extraLinks: row.extraLinks,
    });
    return validated ?? empty;
}
