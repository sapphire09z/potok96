import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isNewsEditor } from "@/lib/newsDraft";
import { newsReviewIssues } from "@/lib/newsReviewIssues";

export const runtime = "nodejs";
const POST_ID = /^c[a-z0-9]{10,40}$/;
const transition = {
    submit: { from: "DRAFT", to: "REVIEW", event: "SUBMITTED" },
    return: { from: "REVIEW", to: "DRAFT", event: "RETURNED", admin: true },
    approve: { from: "REVIEW", to: "APPROVED", event: "APPROVED", admin: true },
    reopen: { from: "APPROVED", to: "DRAFT", event: "REOPENED", admin: true },
    reopen_unpublished: { from: "UNPUBLISHED", to: "DRAFT", event: "REOPENED", admin: true },
};
const fail = (message, status) => NextResponse.json({ error: message }, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (!isNewsEditor(user)) return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!POST_ID.test(id)) return fail("Новость не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);

    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 2500) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }

    const step = transition[input?.action];
    if (!step) return fail("Неизвестное действие.", 400);
    if (step.admin && user.role !== "ADMIN") return fail("Действие доступно только администратору.", 403);
    if (typeof input.expectedUpdatedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T/.test(input.expectedUpdatedAt)) {
        return fail("Обновите страницу перед изменением статуса.", 400);
    }
    const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime())) return fail("Некорректная версия новости.", 400);
    if (input.reason !== undefined && typeof input.reason !== "string") return fail("Некорректный комментарий.", 400);
    const reason = (input.reason ?? "").trim();
    if (reason.length > 1000 || (input.action === "return" && reason.length < 5) ||
        (["reopen", "reopen_unpublished"].includes(input.action) && reason.length < 5)) {
        return fail("Для возврата укажите причину от 5 до 1000 символов.", 400);
    }

    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const post = await tx.newsPost.findUnique({
                where: { id },
                select: {
                    id: true, status: true, slug: true, title: true, body: true,
                    sourceKind: true, sourceName: true, sourceUrl: true, rightsNote: true,
                    coverImageId: true,
                    images: { select: { id: true, credit: true, rightsNote: true } },
                },
            });
            if (!post) return { error: "Новость не найдена.", status: 404 };
            if (post.status !== step.from) return { error: "Статус материала изменился. Обновите страницу.", status: 409 };
            // Обязательные сведения проверяем в момент отправки модератором.
            // Перед одобрением администратором проверяем повторно как страховку.
            if (step.to === "REVIEW" || step.to === "APPROVED") {
                const issues = newsReviewIssues(post);
                if (issues.length) return { error: issues.join(" "), status: 422 };
            }
            const updated = await tx.newsPost.updateMany({
                where: { id, status: step.from, updatedAt: expectedUpdatedAt },
                data: { status: step.to },
            });
            if (updated.count !== 1) return { error: "Материал изменился в другой вкладке. Обновите страницу.", status: 409 };
            await tx.newsWorkflowEvent.create({
                data: { postId: id, actorId: user.id, action: step.event, note: reason || null },
            });
            return { status: step.to };
        });
        if (result.error) return fail(result.error, result.status);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News review workflow failed", error);
        return fail("Не удалось изменить статус материала.", 503);
    }
}
