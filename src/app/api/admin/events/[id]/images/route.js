import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { InvalidMediaError, cleanupPrivateKeys, uploadPrivateImageSet } from "@/lib/media/images";
import { EVENT_ID, isEventVersion } from "@/lib/eventAdmin.mjs";
import { isActiveAdmin } from "@/lib/eventCms";
import { EVENT_IMAGE_LIMIT } from "@/lib/eventMediaPolicy.mjs";

export const runtime = "nodejs";
const MAX_SIZE = 5 * 1024 * 1024;
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!EVENT_ID.test(id)) return reply({ error: "Мероприятие не найдено." }, 404);
    const db = getPrisma();
    if (!(await isActiveAdmin(db, actor))) return reply({ error: "Доступ запрещён." }, 403);
    const version = request.headers.get("x-expected-updated-at");
    if (!isEventVersion(version)) return reply({ error: "Обновите карточку перед загрузкой." }, 400);
    const length = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(length) || length <= 0) return reply({ error: "Не указан размер запроса." }, 411);
    if (length > MAX_SIZE + 128 * 1024) return reply({ error: "Изображение превышает 5 МБ." }, 413);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
        return reply({ error: "Ожидается изображение." }, 415);
    try {
        const existing = await db.eventPost.findUnique({ where: { id }, select: {
            id: true, updatedAt: true, _count: { select: { images: true } },
        } });
        if (!existing) return reply({ error: "Мероприятие не найдено." }, 404);
        if (existing.updatedAt.toISOString() !== version)
            return reply({ error: "Карточка изменилась. Обновите страницу." }, 409);
        if (existing._count.images >= EVENT_IMAGE_LIMIT)
            return reply({ error: `Не более ${EVENT_IMAGE_LIMIT} изображений.` }, 409);
        const body = await request.formData();
        const file = body.get("file");
        if (!file || typeof file.arrayBuffer !== "function" || typeof file.size !== "number" ||
            file.size < 1 || file.size > MAX_SIZE)
            return reply({ error: "Нужен JPEG, PNG или WebP до 5 МБ." }, 400);
        const uploaded = await uploadPrivateImageSet({
            bytes: Buffer.from(await file.arrayBuffer()), area: "events", entityId: id,
        });
        try {
            const result = await db.$transaction(async tx => {
                const count = await tx.eventImage.count({ where: { eventId: id } });
                if (count >= EVENT_IMAGE_LIMIT) return { error: "Лимит изображений достигнут.", status: 409 };
                const changed = await tx.eventPost.updateMany({ where: {
                    id, updatedAt: new Date(version),
                }, data: { updatedAt: new Date() } });
                if (changed.count !== 1) return { error: "Карточка изменилась. Обновите страницу.", status: 409 };
                await tx.eventImage.create({ data: {
                    id: uploaded.photoId, eventId: id, storageKey: uploaded.baseKey, sortOrder: count,
                } });
                return { success: true };
            }, { isolationLevel: "Serializable", timeout: 10000 });
            if (result.error) {
                await cleanupPrivateKeys(uploaded.storedKeys);
                return reply({ error: result.error }, result.status);
            }
            return reply({ success: true, imageId: uploaded.photoId }, 201);
        } catch (error) {
            await cleanupPrivateKeys(uploaded.storedKeys);
            throw error;
        }
    } catch (error) {
        if (error instanceof InvalidMediaError) return reply({ error: error.message }, 400);
        if (["P2034", "P2002"].includes(error?.code))
            return reply({ error: "Карточка изменилась, повторите после обновления." }, 409);
        console.error("Event image upload failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось загрузить изображение." }, 503);
    }
}
