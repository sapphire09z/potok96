import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { validateOrgPremium } from "@/lib/orgPremium";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const VERSION = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const fail = (error, status) => NextResponse.json({ error }, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const actor = await getCurrentUser();
    if (!actor) return fail("Войдите в аккаунт.", 401);
    if (actor.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Организация не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);
    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 16000) return fail("Слишком большой запрос.", 413);
        body = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(key => !["priceItems", "specialOffers", "extraLinks", "expectedUpdatedAt"].includes(key)) ||
        typeof body.expectedUpdatedAt !== "string" || !VERSION.test(body.expectedUpdatedAt) ||
        !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
        return fail("Некорректная версия карточки.", 400);
    }
    const content = validateOrgPremium({
        priceItems: body.priceItems,
        specialOffers: body.specialOffers,
        extraLinks: body.extraLinks,
    });
    if (!content) return fail("Проверьте названия, цены, предложения и HTTPS-ссылки.", 400);

    try {
        // Admin may prepare premium content in advance or edit it on a published
        // card. The PUBLIC reader always gates it by effective placement.
        const prisma = getPrisma();
        const changed = await prisma.organization.updateMany({
            where: { id, updatedAt: new Date(body.expectedUpdatedAt) },
            data: content,
        });
        if (changed.count !== 1) return fail("Карточка изменилась. Обновите страницу.", 409);
        const updated = await prisma.organization.findUnique({
            where: { id }, select: { updatedAt: true },
        });
        return NextResponse.json({ success: true, updatedAt: updated.updatedAt.toISOString() }, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("Organization premium update failed", { code: error?.code || "unknown" });
        return fail("Не удалось сохранить расширенные блоки.", 503);
    }
}
