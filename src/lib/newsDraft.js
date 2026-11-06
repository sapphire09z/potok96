import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";

export function isNewsEditor(user) {
    return user && ["ADMIN", "MODERATOR"].includes(user.role);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COVER_PATTERN = /^\/media\/news\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp|avif)$/i;

function optionalText(value, maxLength) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") return undefined;
    const text = value.trim();
    return text.length <= maxLength ? (text || null) : undefined;
}

export function validateNewsDraft(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { error: "Неверный формат данных." };
    }

    const title = optionalText(input.title, 180);
    const slug = optionalText(input.slug, 160);
    const category = optionalText(input.category, 48);
    const summary = optionalText(input.summary, 600);
    const body = optionalText(input.body, 30000);
    const authorName = optionalText(input.authorName, 120);
    const cover = optionalText(input.cover, 512);
    const sourceName = optionalText(input.sourceName, 180);
    const sourceUrl = optionalText(input.sourceUrl, 2048);
    const sourceText = optionalText(input.sourceText, 20000);

    if (!title || !slug || !SLUG_PATTERN.test(slug) || !category ||
        authorName === undefined || summary === undefined || body === undefined ||
        cover === undefined || sourceName === undefined || sourceUrl === undefined ||
        sourceText === undefined) {
        return { error: "Проверьте заголовок, адрес и заполнение полей." };
    }

    if (cover && !COVER_PATTERN.test(cover)) {
        return { error: "Обложка должна быть изображением из /media/news/." };
    }

    if (sourceUrl) {
        try {
            const url = new URL(sourceUrl);
            if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
                return { error: "Источник должен быть ссылкой HTTPS." };
            }
        } catch {
            return { error: "Укажите корректную ссылку на источник." };
        }
    }

    if (!Array.isArray(input.tags) || input.tags.length > 12 ||
        input.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 40)) {
        return { error: "Можно указать до 12 тегов длиной до 40 символов." };
    }

    const tags = [...new Set(input.tags.map((tag) => tag.trim()))];
    return {
        data: {
            title,
            slug,
            category,
            summary: summary ?? "",
            body: body ?? "",
            authorName: authorName || "Редакция Поток 96",
            cover,
            sourceName,
            sourceUrl,
            sourceText,
            tags,
        },
    };
}

export async function readNewsDraftPayload(request) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
        return { error: "Нужен JSON.", status: 415 };
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 65000) {
        return { error: "Слишком большой текст.", status: 413 };
    }
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return { error: "Некорректный JSON.", status: 400 };
    }
    const checked = validateNewsDraft(data);
    return checked.error ? { ...checked, status: 400 } : checked;
}

// Reserve names already used in Markdown to avoid collisions when the feed migrates.
async function markdownSlugExists(slug) {
    const folder = path.join(process.cwd(), "content", "news");
    const files = await fs.readdir(folder);
    for (const filename of files) {
        if (!filename.endsWith(".md")) continue;
        const raw = await fs.readFile(path.join(folder, filename), "utf8");
        if (matter(raw).data.slug === slug) return true;
    }
    return false;
}

export async function newsSlugExists(slug, exceptId) {
    const [dbPost, inMarkdown] = await Promise.all([
        getPrisma().newsPost.findFirst({
            where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
            select: { id: true },
        }),
        markdownSlugExists(slug),
    ]);
    return Boolean(dbPost || inMarkdown);
}
