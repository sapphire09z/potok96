import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
const fail = (error, status) => NextResponse.json({ error }, {
    status, headers: { "Cache-Control": "no-store" },
});
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function normalizedPhone(input) {
    if (typeof input !== "string" || input.length > 40 || !/^[+0-9()\s-]+$/.test(input)) return null;
    let digits = input.replace(/\D/g, "");
    if (digits.length === 10) digits = `7${digits}`;
    if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    return /^7\d{10}$/.test(digits) ? `+${digits}` : null;
}

export async function POST(request) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const actor = await getCurrentUser();
    if (!actor) return fail("Необходимо войти в аккаунт.", 401);
    if (actor.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);

    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 512) return fail("Слишком большой запрос.", 413);
        body = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(key => key !== "phone")) return fail("Некорректные поля.", 400);
    const phone = normalizedPhone(body.phone);
    if (!phone) return fail("Укажите корректный номер телефона России.", 400);

    const prisma = getPrisma();
    try {
        const result = await prisma.$transaction(async (tx) => {
            const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true } });
            if (currentActor?.role !== "ADMIN") return { error: "Права администратора изменились.", status: 403 };
            const existing = await tx.user.findUnique({ where: { phone }, select: { role: true } });
            if (existing && existing.role !== "USER") {
                return { error: "Этот номер уже принадлежит сотруднику или администратору.", status: 409 };
            }
            const now = new Date();
            // Reissue intentionally invalidates any previous pending link for this phone.
            await tx.staffInvitation.updateMany({
                where: { phone, consumedAt: null, revokedAt: null },
                data: { revokedAt: now },
            });
            const invitation = await tx.staffInvitation.create({
                data: {
                    phone, createdById: actor.id,
                    expiresAt: new Date(now.getTime() + SEVEN_DAYS),
                },
                select: { id: true, phone: true, expiresAt: true },
            });
            return { invitation };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return fail(result.error, result.status);
        return NextResponse.json({ success: true, invitation: result.invitation }, {
            status: 201, headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        if (error?.code === "P2002" || error?.code === "P2034") {
            return fail("Приглашение изменилось. Повторите попытку.", 409);
        }
        console.error("Staff invitation create failed", { code: error?.code || "unknown" });
        return fail("Не удалось подготовить приглашение.", 503);
    }
}
