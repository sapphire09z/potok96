import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { newsReviewIssues } from "@/lib/newsReviewIssues";
import { newsSlugExists } from "@/lib/newsDraft";
import { promoteNewsImages, publicNewsBody, publicNewsCover } from "@/lib/newsMedia";

export const runtime = "nodejs";
const POST_ID = /^c[a-z0-9]{10,40}$/;
const rules = {
    publish: { from: "APPROVED", to: "PUBLISHED", event: "PUBLISHED" },
    unpublish: { from: "PUBLISHED", to: "UNPUBLISHED", event: "UNPUBLISHED" },
    republish: { from: "UNPUBLISHED", to: "PUBLISHED", event: "REPUBLISHED" },
};
const errorJson = (message, status) => NextResponse.json({ error: message }, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return errorJson("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return errorJson("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return errorJson("Действие доступно только администратору.", 403);
    const { id } = await params;
    if (!POST_ID.test(id)) return errorJson("Новость не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return errorJson("Нужен JSON.", 415);

    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 2500) return errorJson("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return errorJson("Некорректный JSON.", 400); }
    const step = rules[input?.action];
    if (!step) return errorJson("Неизвестное действие.", 400);
    if (typeof input.expectedUpdatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(input.expectedUpdatedAt)) {
        return errorJson("Обновите страницу перед публикацией.", 400);
    }
    const expectedAt = new Date(input.expectedUpdatedAt);
    if (!Number.isFinite(expectedAt.getTime())) return errorJson("Некорректная версия новости.", 400);
    if (input.reason !== undefined && typeof input.reason !== "string") return errorJson("Некорректная причина.", 400);
    const note = (input.reason ?? "").trim();
    if (note.length > 1000 || (input.action === "unpublish" && note.length < 5)) {
        return errorJson("Для снятия с публикации укажите причину от 5 до 1000 символов.", 400);
    }

    const prisma = getPrisma();
    try {
        const post = await prisma.newsPost.findUnique({
            where: { id },
            select: {
                id: true, slug: true, status: true, updatedAt: true, publishedAt: true,
                title: true, body: true, sourceKind: true, sourceName: true,
                sourceUrl: true, rightsNote: true, coverImageId: true, cover: true,
                images: {
                    select: { id: true, storageKey: true, credit: true, rightsNote: true },
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                },
            },
        });
        if (!post) return errorJson("Новость не найдена.", 404);
        if (post.status !== step.from || post.updatedAt.getTime() !== expectedAt.getTime()) {
            return errorJson("Материал изменился. Обновите страницу.", 409);
        }
        if (step.to === "PUBLISHED") {
            const issues = newsReviewIssues(post);
            if (issues.length) return errorJson(issues.join(" "), 422);
            if (await newsSlugExists(post.slug, post.id)) {
                return errorJson("Адрес новости уже занят в другой публикации.", 409);
            }
            try {
                publicNewsBody(post);
                publicNewsCover(post);
            } catch (error) {
                console.warn("News public content validation failed", { id, message: error.message });
                return errorJson("Проверьте фотографии в тексте: используйте только изображения, загруженные через галерею этой новости.", 422);
            }
            try {
                await promoteNewsImages(post);
            } catch (error) {
                console.error("News public media promotion failed", { id, error });
                return errorJson("Не удалось скопировать изображения в публичное хранилище. Повторите публикацию после проверки S3.", 503);
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.newsPost.updateMany({
                where: { id, status: step.from, updatedAt: expectedAt },
                data: {
                    status: step.to,
                    ...(step.to === "PUBLISHED" ? { publishedAt: post.publishedAt ?? new Date() } : {}),
                },
            });
            if (updated.count !== 1) return null;
            await tx.newsWorkflowEvent.create({
                data: { postId: id, actorId: user.id, action: step.event, note: note || null },
            });
            return { status: step.to, slug: post.slug };
        });
        if (!result) return errorJson("Статус изменился в другой вкладке. Обновите страницу.", 409);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News publication action failed", error);
        return errorJson("Не удалось изменить состояние публикации.", 503);
    }
}
