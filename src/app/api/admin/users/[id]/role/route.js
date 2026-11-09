import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";

const USER_ID = /^c[a-z0-9]{10,40}$/;
const ROLES = new Set(["USER", "MODERATOR", "ADMIN"]);

function fail(error, status) {
    return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const admin = await getCurrentUser();
    if (!admin) return fail("Необходимо войти в аккаунт.", 401);
    if (admin.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!USER_ID.test(id)) return fail("Пользователь не найден.", 404);
    if (id === admin.id) return fail("Нельзя изменять собственную роль.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);

    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 1200) return fail("Слишком большой запрос.", 413);
        body = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        !ROLES.has(body.role) || !ROLES.has(body.expectedRole) || body.role === body.expectedRole ||
        typeof body.expectedUpdatedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T/.test(body.expectedUpdatedAt)) {
        return fail("Некорректный запрос на изменение роли.", 400);
    }
    const expected = new Date(body.expectedUpdatedAt);
    if (!Number.isFinite(expected.getTime())) return fail("Некорректная версия пользователя.", 400);

    try {
        const result = await getPrisma().$transaction(async (tx) => {
            // Recheck role inside the transaction in case the administrator was demoted.
            const actor = await tx.user.findUnique({ where: { id: admin.id }, select: { role: true } });
            if (actor?.role !== "ADMIN") return { error: "Права администратора изменились.", status: 403 };
            const target = await tx.user.findUnique({ where: { id },
                select: { id: true, role: true, updatedAt: true } });
            if (!target) return { error: "Пользователь не найден.", status: 404 };
            if (target.role !== body.expectedRole || target.updatedAt.getTime() !== expected.getTime()) {
                return { error: "Данные пользователя изменились. Обновите страницу.", status: 409 };
            }
            if (target.role === "ADMIN" && body.role !== "ADMIN") {
                const count = await tx.user.count({ where: { role: "ADMIN" } });
                if (count <= 1) return { error: "Нельзя удалить последнего администратора.", status: 409 };
            }
            const changed = await tx.user.updateMany({
                where: { id, role: body.expectedRole, updatedAt: expected },
                data: { role: body.role },
            });
            if (changed.count !== 1) return { error: "Роль уже изменена. Обновите страницу.", status: 409 };
            await tx.adminRoleChange.create({
                data: { actorId: admin.id, targetId: id, oldRole: target.role, newRole: body.role },
            });
            return { role: body.role };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return fail(result.error, result.status);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error?.code === "P2034") return fail("Конфликт одновременных изменений. Повторите попытку.", 409);
        console.error("Admin role change failed", error);
        return fail("Не удалось изменить роль пользователя.", 503);
    }
}
