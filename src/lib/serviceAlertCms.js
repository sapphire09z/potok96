import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isOfficialAdmin } from "@/lib/officialNoticeCms";
import { ALERT_ID, validAlertVersion, validateServiceAlert } from "@/lib/serviceAlertValidation.mjs";

const ROOT = path.join(process.cwd(), "content", "alerts");
export const alertReply = (value, status = 200) => NextResponse.json(value, {
    status, headers: { "Cache-Control": "no-store" },
});
export function nextAlertVersion(previous) {
    return new Date(Math.max(Date.now(), new Date(previous).getTime() + 1));
}
export async function reservedLegacyAlertSlugs() {
    let files;
    try { files = await fs.readdir(ROOT); }
    catch (e) { if (e?.code === "ENOENT") files = []; else throw e; }
    const reserved = new Set();
    for (const file of files.filter(f => f.endsWith(".md"))) {
        reserved.add(path.basename(file, ".md"));
        const raw = await fs.readFile(path.join(ROOT, file), "utf8");
        const { data } = matter(raw);
        if (typeof data.slug === "string" && data.slug) reserved.add(data.slug);
    }
    return reserved;
}
export async function serviceAlertSlugExists(slug, exceptId = null) {
    if ((await reservedLegacyAlertSlugs()).has(slug)) return true;
    const row = await getPrisma().serviceAlert.findFirst({
        where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
        select: { id: true },
    });
    return Boolean(row);
}
export async function authenticateAlertRequest(request, id = null) {
    if (!hasTrustedOrigin(request)) return { response: alertReply({ error: "Недопустимый источник запроса." }, 403) };
    const actor = await getCurrentUser();
    if (!actor) return { response: alertReply({ error: "Войдите в аккаунт." }, 401) };
    if (id !== null && !ALERT_ID.test(id)) return { response: alertReply({ error: "Сообщение не найдено." }, 404) };
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, actor))) return { response: alertReply({ error: "Доступ запрещён." }, 403) };
    return { actor, db };
}
export async function readAlertRequest(request) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return { error: "Ожидается JSON.", status: 415 };
    let value;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 35000) return { error: "Слишком большой запрос.", status: 413 };
        value = JSON.parse(raw);
    } catch { return { error: "Некорректный JSON.", status: 400 }; }
    const data = validateServiceAlert(value);
    return data ? { data } : { error: "Проверьте поля, дату и время Красноуфимска, интервалы и адрес источника.", status: 400 };
}
export function alertVersionHeader(request) {
    const version = request.headers.get("x-expected-updated-at");
    return validAlertVersion(version) ? version : null;
}
export function revalidateAlertPaths(revalidatePath) {
    revalidatePath("/alerts");
    revalidatePath("/");
}
