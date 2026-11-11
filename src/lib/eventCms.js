import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";
import { validateEventFields } from "@/lib/eventAdmin.mjs";

const EVENTS_DIR = path.join(process.cwd(), "content", "events");

export async function eventSlugExists(slug, exceptId = null) {
    // Reserve ALL Markdown slugs, including unpublished ones, so an old file
    // can never quietly shadow a newly published CMS event.
    let filenames;
    try { filenames = await fs.readdir(EVENTS_DIR); }
    catch (error) { if (error?.code === "ENOENT") filenames = []; else throw error; }
    for (const filename of filenames) {
        if (!filename.endsWith(".md")) continue;
        const raw = await fs.readFile(path.join(EVENTS_DIR, filename), "utf8");
        if (matter(raw).data.slug === slug) return true;
    }
    const found = await getPrisma().eventPost.findFirst({
        where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
        select: { id: true },
    });
    return Boolean(found);
}

export async function parseEventRequest(request, maxBytes = 45000) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return { error: "Ожидается JSON.", status: 415 };
    let data;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > maxBytes) return { error: "Слишком большой запрос.", status: 413 };
        data = JSON.parse(raw);
    } catch { return { error: "Некорректный JSON.", status: 400 }; }
    const fields = validateEventFields(data);
    return fields ? { data: fields } : { error: "Проверьте обязательные поля, даты и ссылки. Дополнительные поля запрещены.", status: 400 };
}

export async function isActiveAdmin(db, actor) {
    if (!actor || actor.role !== "ADMIN") return false;
    const current = await db.user.findUnique({ where: { id: actor.id },
        select: { role: true, archivedAt: true } });
    return current?.role === "ADMIN" && !current.archivedAt;
}
