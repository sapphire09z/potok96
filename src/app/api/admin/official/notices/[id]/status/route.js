import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { NOTICE_ID, validNoticeDate, validNoticeVersion } from "@/lib/officialNoticeValidation.mjs";
import { isOfficialAdmin, officialNoticeSlugExists } from "@/lib/officialNoticeCms";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!NOTICE_ID.test(id)) return reply({ error: "Сообщение не найдено." }, 404);
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, actor))) return reply({ error: "Доступ запрещён." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Ожидается JSON." }, 415);
    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 500) return reply({ error: "Слишком большой запрос." }, 413);
        body = JSON.parse(raw);
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 2 ||
        !Object.hasOwn(body, "action") || !Object.hasOwn(body, "expectedUpdatedAt") ||
        !["publish", "unpublish"].includes(body.action) ||
        !validNoticeVersion(body.expectedUpdatedAt))
        return reply({ error: "Некорректный запрос изменения статуса." }, 400);
    const from = body.action === "publish" ? "DRAFT" : "PUBLISHED";
    const to = body.action === "publish" ? "PUBLISHED" : "DRAFT";
    try {
        const existing = await db.officialNotice.findUnique({ where: { id },
            select: { slug: true, title: true, date: true, issuer: true, content: true,
                status: true, publishedAt: true } });
        if (!existing) return reply({ error: "Сообщение не найдено." }, 404);
        if (existing.status !== from) return reply({ error: "Статус уже изменён. Обновите страницу." }, 409);
        if (to === "PUBLISHED") {
            if (!existing.title.trim() || !existing.issuer.trim() || !existing.content.trim() ||
                !validNoticeDate(existing.date))
                return reply({ error: "Заполните заголовок, дату, ведомство и текст." }, 422);
            if (await officialNoticeSlugExists(existing.slug, id))
                return reply({ error: "Этот адрес занят старым сообщением." }, 409);
        }
        const changed = await db.officialNotice.updateMany({ where: {
            id, status: from, updatedAt: new Date(body.expectedUpdatedAt),
        }, data: { status: to, updatedAt: new Date(),
            ...(to === "PUBLISHED" ? { publishedAt: existing.publishedAt ?? new Date() } : {}) } });
        if (changed.count !== 1) return reply({ error: "Сообщение изменилось. Обновите страницу." }, 409);
        const latest = await db.officialNotice.findUnique({ where: { id }, select: { updatedAt: true } });
        return reply({ success: true, status: to, updatedAt: latest.updatedAt.toISOString() });
    } catch (error) {
        if (error?.code === "P2034") return reply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        console.error("Official notice status failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось изменить публикацию." }, 503);
    }
}
