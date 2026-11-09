import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";

const JSON_HEADERS = { "Cache-Control": "no-store" };
const CONTROL = /\p{Cc}|\p{Cf}/u;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

function fail(error, status) {
    return NextResponse.json({ error }, { status, headers: JSON_HEADERS });
}

export async function PATCH(request) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Необходимо войти в аккаунт.", 401);
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
        return fail("Ожидается JSON.", 415);
    }

    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 2048) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch {
        return fail("Некорректный JSON.", 400);
    }

    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some((key) => !["displayName", "email", "expectedUpdatedAt"].includes(key)) ||
        typeof input.displayName !== "string" || typeof input.email !== "string" ||
        typeof input.expectedUpdatedAt !== "string") {
        return fail("Неверный набор полей профиля.", 400);
    }

    const displayName = input.displayName.normalize("NFC").trim().replace(/\s+/gu, " ");
    const email = input.email.trim().toLowerCase();
    if ((displayName && (displayName.length < 2 || displayName.length > 80 || CONTROL.test(displayName))) ||
        email.length > 254 || (email && !EMAIL.test(email))) {
        return fail("Проверьте имя и адрес электронной почты.", 400);
    }
    const expected = new Date(input.expectedUpdatedAt);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(input.expectedUpdatedAt) || !Number.isFinite(expected.getTime())) {
        return fail("Некорректная версия профиля.", 400);
    }

    const prisma = getPrisma();
    try {
        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.user.findUnique({
                where: { id: user.id },
                select: { displayName: true, email: true, updatedAt: true },
            });
            if (!existing) return { error: "Учётная запись не найдена.", status: 404 };
            if (existing.updatedAt.getTime() !== expected.getTime()) {
                return { error: "Профиль изменился в другой вкладке. Обновите страницу.", status: 409 };
            }
            if (email) {
                const duplicate = await tx.user.findFirst({
                    where: {
                        id: { not: user.id },
                        email: { equals: email, mode: "insensitive" },
                    },
                    select: { id: true },
                });
                if (duplicate) return { error: "Этот e-mail уже указан в другом аккаунте.", status: 409 };
            }
            const changes = {
                displayName: displayName || null,
                email: email || null,
                ...(existing.email !== (email || null) ? { emailVerifiedAt: null } : {}),
            };
            if (existing.displayName === changes.displayName && existing.email === changes.email) {
                return { profile: { displayName: existing.displayName || "", email: existing.email || "", updatedAt: existing.updatedAt.toISOString() } };
            }
            const updated = await tx.user.updateMany({
                where: { id: user.id, updatedAt: expected },
                data: changes,
            });
            if (updated.count !== 1) return { error: "Профиль изменился. Обновите страницу.", status: 409 };
            const saved = await tx.user.findUnique({
                where: { id: user.id },
                select: { displayName: true, email: true, updatedAt: true },
            });
            return { profile: { displayName: saved.displayName || "", email: saved.email || "", updatedAt: saved.updatedAt.toISOString() } };
        }, { isolationLevel: "Serializable", timeout: 10000 });

        if (result.error) return fail(result.error, result.status);
        return NextResponse.json({ success: true, ...result }, { headers: JSON_HEADERS });
    } catch (error) {
        if (error?.code === "P2002") return fail("Этот e-mail уже используется.", 409);
        if (error?.code === "P2034") return fail("Профиль изменился. Повторите попытку.", 409);
        console.error("Profile update failed", { code: error?.code || "unknown" });
        return fail("Не удалось сохранить профиль.", 503);
    }
}
