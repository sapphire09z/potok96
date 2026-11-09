import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";

const USER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/;
const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const fail = (error, status) => NextResponse.json({ error }, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const actor = await getCurrentUser();
    if (!actor) return fail("Необходимо войти в аккаунт.", 401);
    if (actor.role !== "ADMIN") return fail("Доступ запрещён.", 403);

    const { id } = await params;
    if (!USER_ID.test(id)) return fail("Пользователь не найден.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);

    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 700) return fail("Слишком большой запрос.", 413);
        body = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        !["USER", "MODERATOR", "ADMIN"].includes(body.expectedRole) ||
        typeof body.expectedUpdatedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T/.test(body.expectedUpdatedAt)) {
        return fail("Некорректный запрос.", 400);
    }
    const updatedAt = new Date(body.expectedUpdatedAt);
    if (!Number.isFinite(updatedAt.getTime())) return fail("Некорректная версия пользователя.", 400);

    // Self-revocation MUST preserve the authenticated session's token hash.
    let protectedTokenHash = null;
    if (id === actor.id) {
        const token = (await cookies()).get(SESSION_COOKIE)?.value;
        if (!token || !SESSION_TOKEN.test(token)) return fail("Сессия не найдена.", 401);
        protectedTokenHash = createHash("sha256").update(token).digest("hex");
    }

    try {
        const result = await getPrisma().$transaction(async (tx) => {
            // Recheck permissions and the target record inside the transaction.
            const currentActor = await tx.user.findUnique({
                where: { id: actor.id }, select: { role: true },
            });
            if (currentActor?.role !== "ADMIN") return { error: "Права администратора изменились.", status: 403 };
            const target = await tx.user.findUnique({
                where: { id }, select: { role: true, updatedAt: true },
            });
            if (!target) return { error: "Пользователь не найден.", status: 404 };
            if (target.role !== body.expectedRole || target.updatedAt.getTime() !== updatedAt.getTime()) {
                return { error: "Данные пользователя изменились. Обновите страницу.", status: 409 };
            }
            if (protectedTokenHash) {
                const currentSession = await tx.userSession.findFirst({
                    where: { userId: id, tokenHash: protectedTokenHash, expiresAt: { gt: new Date() } },
                    select: { id: true },
                });
                if (!currentSession) return { error: "Текущая сессия не найдена.", status: 409 };
            }
            const revoked = await tx.userSession.deleteMany({
                where: {
                    userId: id,
                    expiresAt: { gt: new Date() },
                    ...(protectedTokenHash ? { tokenHash: { not: protectedTokenHash } } : {}),
                },
            });
            if (revoked.count > 0) {
                await tx.adminSessionRevocation.create({
                    data: { actorId: actor.id, targetId: id, revokedCount: revoked.count },
                });
            }
            return { revoked: revoked.count };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return fail(result.error, result.status);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error?.code === "P2034") return fail("Конфликт одновременных изменений. Повторите запрос.", 409);
        console.error("Admin session revocation failed", { code: error?.code || "unknown" });
        return fail("Не удалось завершить сессии.", 503);
    }
}
