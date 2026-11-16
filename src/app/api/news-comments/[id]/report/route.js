import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { canReceiveNewsComments } from "@/lib/newsComments.mjs";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    const { id } = await params;
    if (!ID.test(id) || !request.headers.get("content-type")?.startsWith("application/json")) return fail("Неверный запрос.", 400);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 1800) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    const reason = typeof input?.reason === "string" ? input.reason.normalize("NFC").trim() : "";
    if (reason.length < 5 || reason.length > 500 || /[\p{Cc}\p{Cf}]/u.test(reason)) {
        return fail("Укажите причину жалобы от 5 до 500 символов.", 400);
    }
    try {
        const result = await getPrisma().$transaction(async tx => {
            const comment = await tx.newsComment.findUnique({ where: { id }, select: {
                authorId: true, status: true,
                post: { select: { status: true, publishedAt: true, commentsEnabled: true } },
            } });
            if (!comment || comment.status !== "APPROVED" || !canReceiveNewsComments(comment.post)) {
                return { error: "Комментарий недоступен.", code: 404 };
            }
            if (comment.authorId === user.id) return { error: "Нельзя пожаловаться на собственный комментарий.", code: 400 };
            const recent = await tx.newsCommentReport.count({ where: { userId: user.id,
                createdAt: { gte: new Date(Date.now() - 86400000) } } });
            if (recent >= 10) return { error: "Лимит жалоб за сутки исчерпан.", code: 429 };
            const existing = await tx.newsCommentReport.findUnique({ where: { commentId_userId: { commentId: id, userId: user.id } }, select: { id: true } });
            if (existing) return { error: "Жалоба уже отправлена.", code: 409 };
            await tx.newsCommentReport.create({ data: { commentId: id, userId: user.id, reason } });
            return { reported: true };
        });
        if (result.error) return fail(result.error, result.code);
        return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error?.code === "P2002") return fail("Жалоба уже отправлена.", 409);
        console.error("News comment report failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось отправить жалобу.", 503);
    }
}
