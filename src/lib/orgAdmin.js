import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";
import { ORG_CATEGORIES } from "@/lib/orgCategories";
import { organizationImageUrl } from "@/lib/orgMedia";
import { effectiveOrgPlacement } from "@/lib/orgPlacement";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE = /^\/media\/orgs\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp|avif)$/i;
const CATEGORIES = new Set(ORG_CATEGORIES.map(item => item.id));

function plain(value, max, required = false) {
    if (typeof value !== "string" || value.length > max) return null;
    const result = value.trim();
    return required && !result ? null : result;
}

function https(value, max = 2048) {
    const text = plain(value, max);
    if (text === null) return null;
    if (!text) return "";
    try {
        const url = new URL(text);
        return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

function strings(value, count, max) {
    if (!Array.isArray(value) || value.length > count ||
        value.some(item => typeof item !== "string" || !item.trim() || item.trim().length > max)) return null;
    return [...new Set(value.map(item => item.trim()))];
}

export function validateOrganization(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Некорректные данные." };
    const expected = ["title", "slug", "type", "category", "area", "locality", "address", "phone", "hours", "tags",
        "services", "website", "email", "mapUrl", "vkUrl", "okUrl", "maxUrl", "logo", "cover", "content"];
    if (Object.keys(input).some(key => !expected.includes(key))) return { error: "Неизвестные поля организации." };
    const data = {
        title: plain(input.title, 160, true),
        slug: plain(input.slug, 160, true),
        type: plain(input.type, 120),
        category: plain(input.category, 32),
        area: plain(input.area, 12),
        locality: plain(input.locality, 120),
        address: plain(input.address, 240),
        phone: plain(input.phone, 100),
        hours: plain(input.hours, 600),
        tags: strings(input.tags, 16, 40),
        services: strings(input.services, 24, 120),
        website: https(input.website),
        email: plain(input.email, 254),
        mapUrl: https(input.mapUrl),
        vkUrl: https(input.vkUrl),
        okUrl: https(input.okUrl),
        maxUrl: https(input.maxUrl),
        logo: plain(input.logo, 512),
        cover: plain(input.cover, 512),
        content: plain(input.content, 12000),
    };
    if (Object.values(data).some(value => value === null) || !SLUG.test(data.slug) ||
        !CATEGORIES.has(data.category) || !["city", "district"].includes(data.area)) {
        return { error: "Проверьте название, адрес страницы, категорию и поля организации." };
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return { error: "Проверьте e-mail организации." };
    }
    if ((data.logo && !IMAGE.test(data.logo)) || (data.cover && !IMAGE.test(data.cover))) {
        return { error: "Пути изображений должны быть внутри /media/orgs/." };
    }
    return { data };
}

export async function parseOrganizationRequest(request) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return { error: "Нужен JSON.", status: 415 };
    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 35000) return { error: "Слишком большой запрос.", status: 413 };
        body = JSON.parse(raw);
    } catch { return { error: "Некорректный JSON.", status: 400 }; }
    const checked = validateOrganization(body);
    return checked.error ? { ...checked, status: 400 } : checked;
}

export async function organizationSlugExists(slug, exceptId = null) {
    // Check both published and unpublished legacy Markdown to avoid hidden collisions.
    const files = await fs.readdir(path.join(process.cwd(), "content", "orgs"));
    for (const name of files) {
        if (!name.endsWith(".md")) continue;
        const raw = await fs.readFile(path.join(process.cwd(), "content", "orgs", name), "utf8");
        if (matter(raw).data.slug === slug) return true;
    }
    const existing = await getPrisma().organization.findFirst({
        where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true },
    });
    return Boolean(existing);
}

export function organizationToPublic(row) {
    const images = row.images ?? [];
    const byId = (id) => images.find(image => image.id === id);
    const logoImage = byId(row.logoImageId);
    const coverImage = byId(row.coverImageId);
    return {
        slug: row.slug, title: row.title, type: row.type, category: row.category,
        area: row.area, locality: row.locality, address: row.address, phone: row.phone,
        hours: row.hours, tags: row.tags, services: row.services,
        logo: logoImage ? organizationImageUrl(row.id, logoImage, 320) : row.logo,
        cover: coverImage ? organizationImageUrl(row.id, coverImage, 960) : row.cover,
        website: row.website, email: row.email, mapUrl: row.mapUrl,
        socials: { vk: row.vkUrl, ok: row.okUrl, max: row.maxUrl },
        gallery: images.filter(image => image.id !== row.logoImageId && image.id !== row.coverImageId)
            .map(image => ({ src: organizationImageUrl(row.id, image, 960),
                alt: image.caption || `Фотография: ${row.title}` })),
        content: row.content, status: "published",
        placement: effectiveOrgPlacement(row),
    };
}
