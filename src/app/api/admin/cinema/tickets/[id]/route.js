import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { normalizeCinemaMoviePageUrl } from "@/lib/cinemaTicketPolicy.mjs";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

// Path parameter is a FILM external ID, not a CinemaSession ID.
export async function PUT(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const user = await getCurrentUser();
    if (!user) return reply({ error: "Требуется вход." }, 401);
    if (user.role !== "ADMIN") return reply({ error: "Недостаточно прав." }, 403);
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id <= 0) return reply({ error: "Некорректный фильм." }, 400);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Ожидается JSON." }, 415);
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > 4000)
        return reply({ error: "Слишком длинный запрос." }, 413);
    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 4000) return reply({ error: "Слишком длинный запрос." }, 413);
        body = JSON.parse(raw);
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        typeof body.ticketPageUrl !== "string" || typeof body.expectedUpdatedAt !== "string")
        return reply({ error: "Некорректные поля." }, 400);
    let ticketPageUrl;
    try { ticketPageUrl = normalizeCinemaMoviePageUrl(body.ticketPageUrl); }
    catch (error) { return reply({ error: error.message }, 400); }
    const expected = new Date(body.expectedUpdatedAt);
    if (!Number.isFinite(expected.getTime()) || expected.toISOString() !== body.expectedUpdatedAt)
        return reply({ error: "Обновите страницу и повторите сохранение." }, 409);
    try {
        const db = getPrisma();
        const movie = await db.cinemaMovie.findUnique({ where: { externalId: id },
            select: { externalId: true, isCurrent: true, updatedAt: true } });
        if (!movie || !movie.isCurrent) return reply({ error: "Фильм не найден в актуальном расписании." }, 409);
        if (movie.updatedAt.getTime() !== expected.getTime())
            return reply({ error: "Данные фильма обновились. Перезагрузите страницу." }, 409);
        const changed = await db.cinemaMovie.updateMany({ where: {
            externalId: id, isCurrent: true, updatedAt: expected,
        }, data: { ticketPageUrl: ticketPageUrl || null } });
        if (changed.count !== 1) return reply({ error: "Данные фильма изменились. Перезагрузите страницу." }, 409);
        const updated = await db.cinemaMovie.findUnique({ where: { externalId: id }, select: { updatedAt: true } });
        return reply({ success: true, ticketPageUrl, updatedAt: updated.updatedAt.toISOString() });
    } catch (error) {
        console.error("Cinema movie ticket link save failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось сохранить адрес фильма." }, 503);
    }
}
