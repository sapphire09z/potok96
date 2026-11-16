import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import {
    canReceiveNewsComments, isValidCommentParent, normalizeCommentText,
    COMMENT_COOLDOWN_MS, COMMENT_DAILY_LIMIT, COMMENT_PENDING_LIMIT,
} from "@/lib/newsComments.mjs";

export const runtime = "nodejs";
const POST_ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт, чтобы оставить комментарий.", 401);
    const { slug } = await params;
    if (!slug || typeof slug !== "string" || slug.length > 160) return fail("Новость не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Ожидается JSON.", 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 4500) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(key => !["body", "parentId"].includes(key)) ||
        (input.parentId !== undefined && input.parentId !== null &&
            (typeof input.parentId !== "string" || !POST_ID.test(input.parentId)))) {
        return fail("Проверьте данные комментария.", 400);
    }
    const body = normalizeCommentText(input.body);
    if (!body) return fail("Введите текст от 2 до 1000 символов без служебных символов.", 400);

    const prisma = getPrisma();
    try {
        const result = await prisma.$transaction(async tx => {
            // One user cannot bypass the cooldown by sending parallel requests.
            const [lock] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(953313, hashtext(${user.id})) AS locked`;
            if (!lock?.locked) return { error: "Предыдущее сообщение ещё обрабатывается.", code: 429 };
            const now = new Date();
            const post = await tx.newsPost.findUnique({ where: { slug },
                select: { id: true, status: true, publishedAt: true, commentsEnabled: true } });
            if (!canReceiveNewsComments(post, now)) return { error: "Комментирование этой новости недоступно.", code: 404 };
            if (input.parentId) {
                const parent = await tx.newsComment.findUnique({ where: { id: input.parentId },
                    select: { postId: true, parentId: true, status: true } });
                if (!isValidCommentParent(parent, post.id)) return { error: "Ответить на этот комментарий нельзя.", code: 409 };
            }
            const last = await tx.newsComment.findFirst({ where: { authorId: user.id },
                orderBy: { createdAt: "desc" }, select: { createdAt: true } });
            if (last && now.getTime() - last.createdAt.getTime() < COMMENT_COOLDOWN_MS) {
                return { error: "Между комментариями должно пройти не менее 30 секунд.", code: 429 };
            }
            const [dayCount, pending] = await Promise.all([
                tx.newsComment.count({ where: { authorId: user.id, createdAt: { gte: new Date(now.getTime() - 86400000) } } }),
                tx.newsComment.count({ where: { authorId: user.id, status: "PENDING" } }),
            ]);
            if (dayCount >= COMMENT_DAILY_LIMIT) return { error: "Достигнут лимит 20 комментариев за 24 часа.", code: 429 };
            if (pending >= COMMENT_PENDING_LIMIT) return { error: "Сначала дождитесь проверки предыдущих комментариев.", code: 429 };
            const comment = await tx.newsComment.create({ data: {
                postId: post.id, authorId: user.id, parentId: input.parentId || null,
                body, status: "PENDING",
            }, select: { id: true } });
            return { id: comment.id, status: "PENDING" };
        }, { timeout: 10000 });
        if (result.error) return fail(result.error, result.code);
        return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News comment submission failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось отправить комментарий.", 503);
    }
}
