import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { cinemaSessionFingerprint, normalizeCinemaTicketUrl } from "@/lib/cinemaTicketPolicy.mjs";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function PUT(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const user = await getCurrentUser();
    if (!user) return reply({ error: "Требуется вход." }, 401);
    if (user.role !== "ADMIN") return reply({ error: "Недостаточно прав." }, 403);
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id <= 0) return reply({ error: "Некорректный сеанс." }, 400);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Ожидается JSON." }, 415);
    const declaredLength = Number(request.headers.get("content-length"));
    if (declaredLength > 6000) return reply({ error: "Слишком длинный запрос." }, 413);
    let body;
    try {
        const text = await request.text();
        if (Buffer.byteLength(text, "utf8") > 6000) return reply({ error: "Слишком длинный запрос." }, 413);
        body = JSON.parse(text);
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        typeof body.pushkinConfirmed !== "boolean" ||
        typeof body.pushkinProofNote !== "string" ||
        typeof body.ticketUrl !== "string") return reply({ error: "Некорректные поля." }, 400);
    if (body.pushkinProofNote.length > 500) return reply({ error: "Слишком длинное обоснование." }, 400);
    const note = body.pushkinProofNote.trim();
    if (body.pushkinConfirmed && note.length < 8)
        return reply({ error: "Для подтверждения Пушкинской карты укажите источник проверки (не менее 8 символов)." }, 400);
    let ticketUrl;
    try { ticketUrl = normalizeCinemaTicketUrl(body.ticketUrl); }
    catch (e) { return reply({ error: e.message }, 400); }
    try {
        const db = getPrisma();
        const session = await db.cinemaSession.findUnique({
            where: { externalId: id }, select: {
                externalId: true, movieExternalId: true, startAt: true, hallExternalId: true,
                hallName: true, isCurrent: true, locked: true, deleted: true, pushkinId: true,
                movie: { select: { isCurrent: true } },
            },
        });
        if (!session || !session.isCurrent || !session.movie.isCurrent || session.locked ||
            session.deleted || session.startAt <= new Date())
            return reply({ error: "Сеанс недоступен или уже прошёл." }, 409);
        if (body.pushkinConfirmed && !/^\d{4,15}$/.test(session.pushkinId ?? ""))
            return reply({ error: "В CinemaWebApi нет корректного PushkinId для данного сеанса." }, 400);
        const fingerprint = cinemaSessionFingerprint(session);
        if (!fingerprint) return reply({ error: "Нельзя подтвердить сеанс без идентификатора." }, 409);
        const changed = await db.cinemaSession.updateMany({ where: {
            externalId: id, isCurrent: true, locked: false, deleted: false,
            movieExternalId: session.movieExternalId, startAt: session.startAt,
            hallExternalId: session.hallExternalId,
            hallName: session.hallName, pushkinId: session.pushkinId,
        }, data: {
            verifiedPushkinId: body.pushkinConfirmed ? session.pushkinId : null,
            pushkinVerifiedFingerprint: body.pushkinConfirmed ? fingerprint : null,
            pushkinProofNote: body.pushkinConfirmed ? note : null,
            ticketUrl: ticketUrl || null,
            ticketVerifiedFingerprint: ticketUrl ? fingerprint : null,
            listingReviewedById: user.id,
            listingReviewedAt: new Date(),
        } });
        if (changed.count !== 1) return reply({ error: "Сеанс обновился, перезагрузите страницу." }, 409);
        return reply({ success: true, pushkinConfirmed: body.pushkinConfirmed, ticketUrl });
    } catch (error) {
        console.error("Cinema ticket verification failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось сохранить подтверждение." }, 503);
    }
}
