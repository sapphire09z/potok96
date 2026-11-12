import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { NOTICE_ID, validNoticeVersion } from "@/lib/officialNoticeValidation.mjs";
import { isOfficialAdmin, officialNoticeSlugExists, readNoticeRequest } from "@/lib/officialNoticeCms";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!NOTICE_ID.test(id)) return reply({ error: "Сообщение не найдено." }, 404);
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, actor))) return reply({ error: "Доступ запрещён." }, 403);
    const version = request.headers.get("x-expected-updated-at");
    if (!validNoticeVersion(version)) return reply({ error: "Обновите страницу перед сохранением." }, 400);
    const parsed = await readNoticeRequest(request);
    if (parsed.error) return reply({ error: parsed.error }, parsed.status);
    try {
        const existing = await db.officialNotice.findUnique({ where: { id },
            select: { slug: true, status: true } });
        if (!existing) return reply({ error: "Сообщение не найдено." }, 404);
        if (existing.status === "PUBLISHED" && existing.slug !== parsed.data.slug)
            return reply({ error: "Адрес опубликованного сообщения менять нельзя. Сначала снимите его с публикации." }, 409);
        if (existing.slug !== parsed.data.slug && await officialNoticeSlugExists(parsed.data.slug, id))
            return reply({ error: "Адрес страницы уже занят." }, 409);
        const changed = await db.officialNotice.updateMany({ where: {
            id, updatedAt: new Date(version), status: existing.status,
        }, data: { ...parsed.data, updatedAt: new Date() } });
        if (changed.count !== 1) return reply({ error: "Данные изменились в другой сессии. Обновите страницу." }, 409);
        const row = await db.officialNotice.findUnique({ where: { id }, select: { updatedAt: true } });
        return reply({ success: true, updatedAt: row.updatedAt.toISOString() });
    } catch (error) {
        if (["P2002", "P2034"].includes(error?.code))
            return reply({ error: "Адрес занят или данные изменились. Обновите страницу." }, 409);
        console.error("Official notice update failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось сохранить сообщение." }, 503);
    }
}
