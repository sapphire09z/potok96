import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { getPrisma } from "@/lib/prisma";
import { placementEndFromDate } from "@/lib/orgPlacement";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Организация не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
        return fail("Нужен JSON.", 415);
    }
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 500) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }

    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(key => !["placement", "untilDate", "expectedUpdatedAt"].includes(key)) ||
        !["BASIC", "EXTENDED"].includes(input.placement) ||
        typeof input.expectedUpdatedAt !== "string" ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.expectedUpdatedAt) ||
        !Number.isFinite(Date.parse(input.expectedUpdatedAt)) ||
        typeof input.untilDate !== "string") {
        return fail("Проверьте тип размещения и версию карточки.", 400);
    }

    let extendedUntil = null;
    if (input.placement === "EXTENDED") {
        extendedUntil = placementEndFromDate(input.untilDate);
        if (!extendedUntil || extendedUntil.getTime() <= Date.now() ||
            extendedUntil.getTime() > Date.now() + 5 * 366 * 24 * 60 * 60 * 1000) {
            return fail("Укажите дату окончания от сегодняшнего дня до пяти лет вперёд.", 400);
        }
    } else if (input.untilDate !== "") {
        return fail("Для обычной карточки дата окончания должна быть пустой.", 400);
    }

    try {
        // Optimistic locking protects the editor against stale concurrent writes.
        const changed = await getPrisma().organization.updateMany({
            where: { id, updatedAt: new Date(input.expectedUpdatedAt) },
            data: { placement: input.placement, extendedUntil },
        });
        if (changed.count !== 1) return fail("Карточка изменилась. Обновите страницу.", 409);
        const updated = await getPrisma().organization.findUnique({ where: { id },
            select: { updatedAt: true, placement: true, extendedUntil: true } });
        return NextResponse.json({ success: true,
            updatedAt: updated.updatedAt.toISOString(),
            placement: updated.placement,
            extendedUntil: updated.extendedUntil?.toISOString() ?? null,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Organization placement update failed", { code: error?.code || "unknown" });
        return fail("Не удалось изменить тип размещения.", 503);
    }
}
