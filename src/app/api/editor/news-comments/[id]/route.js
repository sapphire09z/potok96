import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { nextModerationStatus } from "@/lib/newsComments.mjs";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const actions = { approve: "APPROVE", reject: "REJECT", hide: "HIDE" };
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (!["ADMIN", "MODERATOR"].includes(user.role)) return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Комментарий не найден.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Ожидается JSON.", 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 2000) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(key => !["action", "note", "expectedUpdatedAt"].includes(key)) ||
        !Object.hasOwn(actions, input.action) || typeof input.expectedUpdatedAt !== "string" ||
        (input.note !== undefined && typeof input.note !== "string")) {
        return fail("Некорректные данные решения.", 400);
    }
    const note = (input.note ?? "").normalize("NFC").trim();
    if (note.length > 500 || /[\p{Cc}\p{Cf}]/u.test(note) ||
        (input.action !== "approve" && note.length < 5)) {
        return fail("Для отказа или скрытия нужна причина от 5 до 500 символов.", 400);
    }
    const expected = new Date(input.expectedUpdatedAt);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(input.expectedUpdatedAt) || !Number.isFinite(expected.getTime())) {
        return fail("Некорректная версия комментария.", 400);
    }
    try {
        const result = await getPrisma().$transaction(async tx => {
            const comment = await tx.newsComment.findUnique({ where: { id },
                select: { status: true, parentId: true, postId: true } });
            if (!comment) return { error: "Комментарий не найден.", code: 404 };
            const target = nextModerationStatus(comment.status, input.action);
            if (!target) return { error: "Это действие недоступно для текущего статуса.", code: 409 };
            if (target === "APPROVED" && comment.parentId) {
                const parent = await tx.newsComment.findUnique({ where: { id: comment.parentId },
                    select: { status: true, postId: true, parentId: true } });
                if (!parent || parent.status !== "APPROVED" || parent.postId !== comment.postId || parent.parentId) {
                    return { error: "Сначала должен быть опубликован родительский комментарий.", code: 409 };
                }
            }
            const changed = await tx.newsComment.updateMany({ where: { id, updatedAt: expected, status: comment.status },
                data: { status: target, moderatedById: user.id, moderatedAt: new Date(), moderationNote: note || null } });
            if (changed.count !== 1) return { error: "Комментарий уже изменён. Обновите страницу.", code: 409 };
            await tx.newsCommentEvent.create({ data: {
                commentId: id, actorId: user.id, action: actions[input.action],
                fromStatus: comment.status, toStatus: target, note: note || null,
            } });
            return { status: target };
        });
        if (result.error) return fail(result.error, result.code);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News comment moderation failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось обработать комментарий.", 503);
    }
}
