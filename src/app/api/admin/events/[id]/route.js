import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { EVENT_ID, isEventVersion } from "@/lib/eventAdmin.mjs";
import { eventSlugExists, isActiveAdmin, parseEventRequest } from "@/lib/eventCms";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!EVENT_ID.test(id)) return reply({ error: "Мероприятие не найдено." }, 404);
    const db = getPrisma();
    if (!(await isActiveAdmin(db, actor))) return reply({ error: "Доступ запрещён." }, 403);
    const version = request.headers.get("x-expected-updated-at");
    if (!isEventVersion(version)) return reply({ error: "Обновите страницу перед сохранением." }, 400);
    const parsed = await parseEventRequest(request);
    if (parsed.error) return reply({ error: parsed.error }, parsed.status);
    try {
        const existing = await db.eventPost.findUnique({ where: { id },
            select: { id: true, slug: true, status: true, updatedAt: true } });
        if (!existing) return reply({ error: "Мероприятие не найдено." }, 404);
        if (existing.status === "PUBLISHED" && existing.slug !== parsed.data.slug)
            return reply({ error: "Нельзя менять адрес уже опубликованного события. Сначала снимите его с публикации." }, 409);
        if (existing.slug !== parsed.data.slug && await eventSlugExists(parsed.data.slug, id))
            return reply({ error: "Такой адрес уже занят." }, 409);
        const changed = await db.eventPost.updateMany({ where: {
            id, status: existing.status, updatedAt: new Date(version),
        }, data: parsed.data });
        if (changed.count !== 1) return reply({ error: "Карточка изменилась в другой сессии. Обновите страницу." }, 409);
        const latest = await db.eventPost.findUnique({ where: { id }, select: { updatedAt: true } });
        return reply({ success: true, updatedAt: latest.updatedAt.toISOString() });
    } catch (error) {
        if (error?.code === "P2002") return reply({ error: "Такой адрес уже занят." }, 409);
        console.error("Update event failed", { code: error?.code || "unknown" });
        return reply({ error: "Не удалось сохранить мероприятие." }, 503);
    }
}
