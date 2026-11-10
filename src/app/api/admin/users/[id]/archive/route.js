import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
const USER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/;
const fail = (error, status) => NextResponse.json({ error }, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const admin = await getCurrentUser();
    if (!admin) return fail("Необходимо войти.", 401);
    if (admin.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!USER_ID.test(id)) return fail("Пользователь не найден.", 404);
    if (id === admin.id) return fail("Собственный аккаунт нельзя архивировать.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);

    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 600) return fail("Слишком большой запрос.", 413);
        body = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(k => !["action", "expectedUpdatedAt"].includes(k)) ||
        !["archive", "restore"].includes(body.action) ||
        typeof body.expectedUpdatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(body.expectedUpdatedAt)) {
        return fail("Некорректный запрос.", 400);
    }
    const expected = new Date(body.expectedUpdatedAt);
    if (!Number.isFinite(expected.getTime())) return fail("Некорректная версия аккаунта.", 400);

    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const actor = await tx.user.findUnique({
                where: { id: admin.id }, select: { role: true, archivedAt: true },
            });
            if (actor?.role !== "ADMIN" || actor.archivedAt) return { error: "Права администратора изменились.", status: 403 };
            const target = await tx.user.findUnique({
                where: { id }, select: { id: true, role: true, updatedAt: true, archivedAt: true },
            });
            if (!target) return { error: "Пользователь не найден.", status: 404 };
            if (target.updatedAt.getTime() !== expected.getTime()) {
                return { error: "Данные изменились. Обновите страницу.", status: 409 };
            }
            const archive = body.action === "archive";
            if (archive && target.archivedAt) return { error: "Аккаунт уже в архиве.", status: 409 };
            if (!archive && !target.archivedAt) return { error: "Аккаунт не архивирован.", status: 409 };
            if (archive && target.role === "ADMIN") {
                return { error: "Нельзя архивировать ADMIN. Сначала измените роль.", status: 403 };
            }
            const changed = await tx.user.updateMany({
                where: { id, updatedAt: expected, archivedAt: archive ? null : { not: null } },
                data: { archivedAt: archive ? new Date() : null },
            });
            if (changed.count !== 1) return { error: "Запись изменилась. Обновите страницу.", status: 409 };
            let revoked = 0;
            if (archive) {
                const removed = await tx.userSession.deleteMany({ where: { userId: id } });
                revoked = removed.count;
                if (revoked > 0) await tx.adminSessionRevocation.create({
                    data: { actorId: admin.id, targetId: id, revokedCount: revoked },
                });
            }
            await tx.adminUserArchive.create({
                data: { actorId: admin.id, targetId: id, action: archive ? "ARCHIVED" : "RESTORED", revokedCount: revoked },
            });
            return { success: true, action: body.action, revoked };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return fail(result.error, result.status);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error?.code === "P2034") return fail("Конфликт изменений. Повторите попытку.", 409);
        console.error("Archive user failed", { code: error?.code || "unknown" });
        return fail("Не удалось изменить состояние аккаунта.", 503);
    }
}
