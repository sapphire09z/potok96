import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function DELETE(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    const { id } = await params;
    if (!ID.test(id)) return fail("Комментарий не найден.", 404);
    try {
        const result = await getPrisma().$transaction(async tx => {
            const comment = await tx.newsComment.findUnique({ where: { id },
                select: { authorId: true, status: true } });
            if (!comment || comment.authorId !== user.id) return { error: "Комментарий не найден.", code: 404 };
            if (comment.status === "DELETED") return { removed: true };
            const changed = await tx.newsComment.updateMany({ where: { id, authorId: user.id, status: comment.status },
                data: { body: "", status: "DELETED", moderationNote: null } });
            if (changed.count !== 1) return { error: "Комментарий изменился, обновите страницу.", code: 409 };
            await tx.newsCommentEvent.create({ data: {
                commentId: id, actorId: user.id, action: "DELETE", fromStatus: comment.status, toStatus: "DELETED",
            } });
            return { removed: true };
        });
        if (result.error) return fail(result.error, result.code);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News comment deletion failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось удалить комментарий.", 503);
    }
}
