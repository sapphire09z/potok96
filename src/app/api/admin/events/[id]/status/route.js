import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { EVENT_ID, isEventVersion } from "@/lib/eventAdmin.mjs";
import { eventSlugExists, isActiveAdmin } from "@/lib/eventCms";
import { canDisplayEventImage } from "@/lib/eventMediaPolicy.mjs";
import { promoteEventImage } from "@/lib/eventMedia";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!EVENT_ID.test(id)) return reply({ error: "Мероприятие не найдено." }, 404);
    const db = getPrisma();
    if (!(await isActiveAdmin(db, actor))) return reply({ error: "Доступ запрещён." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Ожидается JSON." }, 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 500) return reply({ error: "Слишком большой запрос." }, 413);
        input = JSON.parse(raw);
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).length !== 2 || !["action", "expectedUpdatedAt"].every(key => Object.hasOwn(input, key)) ||
        !["publish", "unpublish"].includes(input.action) || !isEventVersion(input.expectedUpdatedAt))
        return reply({ error: "Некорректный статус или версия карточки." }, 400);
    const from = input.action === "publish" ? "DRAFT" : "PUBLISHED";
    const to = input.action === "publish" ? "PUBLISHED" : "DRAFT";
    try {
        const existing = await db.eventPost.findUnique({ where: { id }, select: {
            slug: true, status: true, title: true, startAt: true, endAt: true,
            pushkinCard: true, pushkinProofUrl: true, publishedAt: true,
            coverImageId: true, updatedAt: true,
            images: { select: { id: true, eventId: true, storageKey: true, credit: true, rightsNote: true } },
        } });
        if (!existing) return reply({ error: "Мероприятие не найдено." }, 404);
        if (existing.status !== from) return reply({ error: "Статус уже изменился. Обновите страницу." }, 409);
        if (to === "PUBLISHED") {
            if (!existing.title.trim() || !Number.isFinite(existing.startAt.getTime()) ||
                (existing.endAt && existing.endAt < existing.startAt) ||
                (existing.pushkinCard && !existing.pushkinProofUrl))
                return reply({ error: "Заполните дату, название и подтверждение Пушкинской карты." }, 422);
            if (await eventSlugExists(existing.slug, id))
                return reply({ error: "Адрес страницы занят старым мероприятием." }, 409);
            if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt)
                return reply({ error: "Карточка изменилась. Обновите страницу." }, 409);
            if (existing.coverImageId) {
                const cover = existing.images.find(img => img.id === existing.coverImageId);
                if (!canDisplayEventImage({ id }, cover))
                    return reply({ error: "Укажите автора и основание использования выбранной афиши." }, 422);
                try { await promoteEventImage(id, cover); }
                catch (error) {
                    console.error("Event cover CDN promotion failed", { code: error?.code ?? "unknown" });
                    return reply({ error: "Не удалось разместить обложку в CDN. Мероприятие не опубликовано." }, 503);
                }
            }
        }
        const changed = await db.eventPost.updateMany({ where: {
            id, status: from, updatedAt: new Date(input.expectedUpdatedAt),
        }, data: { status: to, ...(to === "PUBLISHED" ? { publishedAt: existing.publishedAt ?? new Date() } : {}) } });
        if (changed.count !== 1) return reply({ error: "Карточка изменилась. Обновите страницу." }, 409);
        const latest = await db.eventPost.findUnique({ where: { id }, select: { updatedAt: true } });
        return reply({ success: true, status: to, updatedAt: latest.updatedAt.toISOString() });
    } catch (error) {
        if (error?.code === "P2034") return reply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        console.error("Event status failed", { code: error?.code || "unknown" });
        return reply({ error: "Не удалось изменить публикацию." }, 503);
    }
}
