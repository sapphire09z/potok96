import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Настройки комментариев меняет только администратор.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Новость не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Ожидается JSON.", 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 1000) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(k => !["enabled", "expectedUpdatedAt"].includes(k)) ||
        typeof input.enabled !== "boolean" || typeof input.expectedUpdatedAt !== "string") {
        return fail("Некорректные настройки комментариев.", 400);
    }
    const expected = new Date(input.expectedUpdatedAt);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(input.expectedUpdatedAt) || !Number.isFinite(expected.getTime())) {
        return fail("Некорректная версия новости.", 400);
    }
    try {
        const updated = await getPrisma().newsPost.updateMany({
            where: { id, updatedAt: expected, status: { in: ["APPROVED", "PUBLISHED", "UNPUBLISHED"] } },
            data: { commentsEnabled: input.enabled },
        });
        if (updated.count !== 1) return fail("Новость изменена или недоступна. Обновите страницу.", 409);
        return NextResponse.json({ enabled: input.enabled }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News comments settings update failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось сохранить настройки комментариев.", 503);
    }
}
