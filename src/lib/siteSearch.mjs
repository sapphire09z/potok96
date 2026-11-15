// Stage 5.10: pure, testable search over already-public portal content.
// Source adapters deliberately validate the public status again (defense in depth).
export const SEARCH_SECTIONS = Object.freeze([
    { id: "news", title: "Новости" },
    { id: "events", title: "Мероприятия" },
    { id: "orgs", title: "Организации" },
    { id: "ads", title: "Объявления" },
    { id: "notices", title: "Официальные сообщения" },
    { id: "documents", title: "Нормативные документы" },
    { id: "alerts", title: "Городские службы" },
]);

const ALLOWED = new Set(SEARCH_SECTIONS.map(section => section.id));
const MAX_QUERY = 120;
const MAX_RESULTS = 40;

function text(value) { return typeof value === "string" ? value : ""; }
function strings(values) { return Array.isArray(values) ? values.filter(v => typeof v === "string") : []; }
function normalize(value) {
    return text(value).normalize("NFKC").toLocaleLowerCase("ru-RU")
        .replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
export function searchQuery(value) {
    return (typeof value === "string" ? value : "")
        .replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_QUERY);
}
export function searchSection(value) { return ALLOWED.has(value) ? value : ""; }

function item(type, row, url, searchFields, description, detail, rawDate) {
    const title = text(row?.title).trim();
    if (!title || typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return null;
    return {
        type, title, url,
        description: text(description).replace(/\s+/g, " ").trim().slice(0, 220),
        detail: text(detail).replace(/\s+/g, " ").trim().slice(0, 140),
        timestamp: new Date(rawDate ?? 0).getTime() || 0,
        searchText: normalize([title, ...searchFields].filter(Boolean).join(" ")),
        titleText: normalize(title),
    };
}
function validSlug(value) {
    // The link always stays inside the portal; encodeURIComponent also handles legacy slugs.
    if (typeof value !== "string" || !value.trim() || value.length > 180) return null;
    try { return encodeURIComponent(value); } catch { return null; }
}
function fromPublicCollections(data) {
    const items = [];
    function add(entry) { if (entry) items.push(entry); }
    for (const row of data.news ?? []) {
        if (row.status !== "published") continue;
        const slug = validSlug(row.slug); if (!slug) continue;
        add(item("news", row, `/news/${slug}`, [row.summary, row.category, ...strings(row.tags)],
            row.summary, row.category, row.date));
    }
    for (const row of data.events ?? []) {
        if (row.status !== "published") continue;
        const slug = validSlug(row.slug); if (!slug) continue;
        add(item("events", row, `/events/${slug}`, [row.summary, row.location, row.category, row.org],
            row.summary, row.location, row.startAt));
    }
    for (const row of data.orgs ?? []) {
        if (row.status !== "published") continue;
        const slug = validSlug(row.slug); if (!slug) continue;
        add(item("orgs", row, `/orgs/${slug}`,
            [row.type, row.address, row.locality, row.category, ...strings(row.tags), ...strings(row.services)],
            [row.type, row.address].filter(Boolean).join(" · "), row.locality, ""));
    }
    for (const row of data.ads ?? []) {
        if (row.status !== "published") continue;
        const slug = validSlug(row.slug); if (!slug) continue;
        add(item("ads", row, `/ads/${slug}`, [row.summary, row.content, row.category, row.location, ...strings(row.tags)],
            row.summary || row.content, [row.price, row.location].filter(Boolean).join(" · "), row.date));
    }
    for (const row of data.notices ?? []) {
        if (row.status !== "published") continue;
        const slug = validSlug(row.slug); if (!slug) continue;
        add(item("notices", row, `/official/notices/${slug}`,
            [row.summary, row.content, row.issuer, row.locality],
            row.summary || row.content, row.issuer, row.date));
    }
    for (const row of data.documents ?? []) {
        if (row.status !== "published") continue;
        const title = text(row.title).trim(); if (!title) continue;
        // NPA have a filtered public register, not a per-document detail route.
        add(item("documents", row, `/official/documents?q=${encodeURIComponent(title)}`,
            [row.number, row.type, row.description, row.issuer, row.date],
            row.description, [row.type, row.number ? `№ ${row.number}` : "", row.issuer].filter(Boolean).join(" · "), row.date));
    }
    for (const row of data.alerts ?? []) {
        if (row.status !== "published") continue;
        const slug = validSlug(row.slug); if (!slug) continue;
        add(item("alerts", row, `/alerts#alert-${slug}`,
            [row.addresses, row.content, row.source, row.service],
            row.content || row.addresses, [row.addresses, row.source].filter(Boolean).join(" · "), row.startAt));
    }
    return items;
}

export function searchPublicContent(collections, rawQuery, rawSection = "") {
    const query = searchQuery(rawQuery);
    const section = searchSection(rawSection);
    if (normalize(query).length < 2) return { query, section, total: 0, results: [], counts: {} };
    const terms = normalize(query).split(" ").filter(Boolean);
    const matches = fromPublicCollections(collections ?? {}).filter(entry =>
        terms.every(word => entry.searchText.includes(word)));
    const counts = Object.fromEntries(SEARCH_SECTIONS.map(({ id }) =>
        [id, matches.filter(entry => entry.type === id).length]));
    const selected = section ? matches.filter(entry => entry.type === section) : matches;
    const sorted = selected.map(entry => {
        const titleMatch = terms.every(word => entry.titleText.includes(word));
        const rank = entry.titleText === normalize(query) ? 4 :
            entry.titleText.startsWith(normalize(query)) ? 3 : titleMatch ? 2 : 1;
        return { ...entry, rank };
    }).sort((a, b) => b.rank - a.rank || b.timestamp - a.timestamp || a.title.localeCompare(b.title, "ru"));
    return { query, section, total: sorted.length,
        results: sorted.slice(0, MAX_RESULTS).map(({ searchText, titleText, rank, timestamp, ...result }) => result), counts };
}
