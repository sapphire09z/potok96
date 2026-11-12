import fs from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "@/lib/prisma";
import { validateOfficialNotice } from "@/lib/officialNoticeValidation.mjs";

const ROOT = path.join(process.cwd(), "content", "official", "notices");

export async function officialNoticeSlugExists(slug, exceptId = null) {
    // Reserve ALL Markdown filenames, including drafts. The old file must never
    // accidentally eclipse a published CMS notice with the same public URL.
    let files;
    try { files = await fs.readdir(ROOT); }
    catch (e) { if (e?.code === "ENOENT") files = []; else throw e; }
    if (files.some(f => f.endsWith(".md") && f.slice(0, -3) === slug)) return true;
    const match = await getPrisma().officialNotice.findFirst({
        where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
        select: { id: true },
    });
    return Boolean(match);
}

export async function readNoticeRequest(request) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return { error: "Ожидается JSON.", status: 415 };
    let value;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 45000)
            return { error: "Слишком большой запрос.", status: 413 };
        value = JSON.parse(raw);
    } catch { return { error: "Некорректный JSON.", status: 400 }; }
    const data = validateOfficialNotice(value);
    return data ? { data } : {
        error: "Проверьте название, дату, ведомство, текст, адрес страницы и HTTPS-ссылку.", status: 400,
    };
}

export async function isOfficialAdmin(db, user) {
    if (user?.role !== "ADMIN") return false;
    const current = await db.user.findUnique({ where: { id: user.id },
        select: { role: true, archivedAt: true } });
    return current?.role === "ADMIN" && !current.archivedAt;
}
