import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function DELETE(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const actor = await getCurrentUser();
    if (!actor) return fail("Необходимо войти в аккаунт.", 401);
    if (actor.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Приглашение не найдено.", 404);

    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const current = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true } });
            if (current?.role !== "ADMIN") return { error: "Права администратора изменились.", status: 403 };
            const updated = await tx.staffInvitation.updateMany({
                where: { id, consumedAt: null, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            if (updated.count !== 1) return { error: "Приглашение уже закрыто или не найдено.", status: 409 };
            return { success: true };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return fail(result.error, result.status);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error?.code === "P2034") return fail("Конфликт изменений. Повторите попытку.", 409);
        console.error("Staff invitation revoke failed", { code: error?.code || "unknown" });
        return fail("Не удалось отозвать приглашение.", 503);
    }
}
