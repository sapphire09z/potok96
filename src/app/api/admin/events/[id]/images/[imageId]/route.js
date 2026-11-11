import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { getPrivate, deletePrivate, deletePublic } from "@/lib/media/s3";
import { EVENT_ID, isEventVersion } from "@/lib/eventAdmin.mjs";
import { isActiveAdmin } from "@/lib/eventCms";
import { EVENT_IMAGE_ID, EVENT_IMAGE_SIZES, eventImageKey,
    eventImageMetadata, canDisplayEventImage } from "@/lib/eventMediaPolicy.mjs";
import { promoteEventImage } from "@/lib/eventMedia";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

async function allowed(request, params, change = false) {
    if (change && !hasTrustedOrigin(request)) return { error: "Недопустимый источник запроса.", status: 403 };
    const actor = await getCurrentUser();
    if (!actor) return { error: "Войдите в аккаунт.", status: 401 };
    const { id, imageId } = await params;
    if (!EVENT_ID.test(id) || !EVENT_IMAGE_ID.test(imageId))
        return { error: "Изображение не найдено.", status: 404 };
    const db = getPrisma();
    if (!(await isActiveAdmin(db, actor))) return { error: "Доступ запрещён.", status: 403 };
    return { db, id, imageId };
}

export async function GET(request, { params }) {
    const scope = await allowed(request, params);
    if (scope.error) return new Response(null, { status: scope.status });
    const { db, id, imageId } = scope;
    const size = Number(new URL(request.url).searchParams.get("size") || 320);
    if (!EVENT_IMAGE_SIZES.includes(size)) return new Response(null, { status: 400 });
    try {
        const image = await db.eventImage.findFirst({ where: { id: imageId, eventId: id },
            select: { id: true, storageKey: true } });
        if (!image) return new Response(null, { status: 404 });
        const object = await getPrivate(`${eventImageKey(id, image)}/${size}.webp`);
        if (!object.Body) return new Response(null, { status: 404 });
        return new Response(await object.Body.transformToByteArray(), { headers: {
            "Content-Type": "image/webp", "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
        } });
    } catch (error) {
        console.error("Event private image read failed", { code: error?.code ?? "unknown" });
        return new Response(null, { status: 503 });
    }
}

export async function PATCH(request, { params }) {
    const scope = await allowed(request, params, true);
    if (scope.error) return reply({ error: scope.error }, scope.status);
    const { db, id, imageId } = scope;
    const version = request.headers.get("x-expected-updated-at");
    if (!isEventVersion(version)) return reply({ error: "Обновите страницу перед изменением." }, 400);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Ожидается JSON." }, 415);
    let data;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 5000) return reply({ error: "Слишком большой запрос." }, 413);
        data = JSON.parse(raw);
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!data || typeof data !== "object" || Array.isArray(data))
        return reply({ error: "Некорректные параметры." }, 400);
    const action = data.action;
    const metadata = action === "metadata" ? eventImageMetadata(data) : null;
    if ((action === "metadata" && !metadata) ||
        (action !== "metadata" && (!["cover", "clearCover"].includes(action) ||
            Object.keys(data).length !== 1)))
        return reply({ error: "Некорректная операция или сведения об авторе." }, 400);

    try {
        // For an already published event, promote the complete immutable S3 image
        // before switching the public DB pointer; failure leaves the old cover intact.
        if (action === "cover") {
            const item = await db.eventPost.findUnique({ where: { id }, select: { id: true, status: true, updatedAt: true } });
            const image = await db.eventImage.findFirst({ where: { id: imageId, eventId: id } });
            if (!item || !image) return reply({ error: "Изображение не найдено." }, 404);
            if (item.updatedAt.toISOString() !== version) return reply({ error: "Карточка изменилась. Обновите страницу." }, 409);
            if (!canDisplayEventImage(item, image))
                return reply({ error: "Сначала сохраните автора и основание использования изображения." }, 422);
            if (item.status === "PUBLISHED") {
                try { await promoteEventImage(id, image); }
                catch (error) {
                    console.error("Event cover CDN promotion failed", { code: error?.code ?? "unknown" });
                    return reply({ error: "Не удалось разместить обложку в CDN. Публичная карточка не изменена." }, 503);
                }
            }
        }
        const result = await db.$transaction(async tx => {
            const event = await tx.eventPost.findUnique({ where: { id }, select: {
                id: true, status: true, coverImageId: true,
            } });
            const image = await tx.eventImage.findFirst({ where: { id: imageId, eventId: id } });
            if (!event || !image) return { error: "Изображение не найдено.", status: 404 };
            if (action === "cover" && !canDisplayEventImage(event, image))
                return { error: "Укажите автора и основание использования.", status: 422 };
            if (action === "clearCover" && event.coverImageId !== imageId)
                return { error: "Эта афиша уже не является основной. Обновите страницу.", status: 409 };
            if (action === "metadata" && event.status === "PUBLISHED" &&
                event.coverImageId === imageId && (!metadata.credit || !metadata.rightsNote))
                return { error: "У опубликованной обложки должны быть указаны права использования.", status: 422 };
            const changed = await tx.eventPost.updateMany({ where: {
                id, updatedAt: new Date(version),
            }, data: { updatedAt: new Date() } });
            if (changed.count !== 1) return { error: "Карточка изменилась. Обновите страницу.", status: 409 };
            if (action === "metadata") {
                await tx.eventImage.update({ where: { id: imageId }, data: metadata });
            } else {
                await tx.eventPost.update({ where: { id }, data: {
                    coverImageId: action === "cover" ? imageId : (event.coverImageId === imageId ? null : event.coverImageId),
                } });
            }
            return { success: true };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        return result.error ? reply({ error: result.error }, result.status) : reply(result);
    } catch (error) {
        if (error?.code === "P2034") return reply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        console.error("Event image change failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось сохранить изменения." }, 503);
    }
}

export async function DELETE(request, { params }) {
    const scope = await allowed(request, params, true);
    if (scope.error) return reply({ error: scope.error }, scope.status);
    const { db, id, imageId } = scope;
    const version = request.headers.get("x-expected-updated-at");
    if (!isEventVersion(version)) return reply({ error: "Обновите страницу перед удалением." }, 400);
    try {
        const result = await db.$transaction(async tx => {
            const event = await tx.eventPost.findUnique({ where: { id }, select: { id: true, coverImageId: true } });
            const image = await tx.eventImage.findFirst({ where: { id: imageId, eventId: id } });
            if (!event || !image) return { error: "Изображение не найдено.", status: 404 };
            const changed = await tx.eventPost.updateMany({ where: {
                id, updatedAt: new Date(version),
            }, data: { updatedAt: new Date() } });
            if (changed.count !== 1) return { error: "Карточка изменилась. Обновите страницу.", status: 409 };
            if (event.coverImageId === imageId) {
                await tx.eventPost.update({ where: { id }, data: { coverImageId: null } });
            }
            await tx.eventImage.delete({ where: { id: imageId } });
            return { key: eventImageKey(id, image) };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return reply({ error: result.error }, result.status);
        const keys = ["jpg", "png", "webp"].map(ext => `${result.key}/original.${ext}`)
            .concat(EVENT_IMAGE_SIZES.map(size => `${result.key}/${size}.webp`));
        // Delete from both buckets. CDN edge caches may retain an immutable URL
        // for their configured TTL, so removal from the public page is immediate
        // but network-wide revocation is not guaranteed.
        const cleanup = await Promise.allSettled([
            ...keys.map(key => deletePrivate(key)),
            ...EVENT_IMAGE_SIZES.map(size => deletePublic(`${result.key}/${size}.webp`)),
        ]);
        const pending = cleanup.some(item => item.status === "rejected");
        if (pending) console.error("Event private S3 cleanup incomplete", { id, imageId });
        return reply({ success: true, storageCleanupPending: pending });
    } catch (error) {
        if (error?.code === "P2034") return reply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        console.error("Event image removal failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось удалить изображение." }, 503);
    }
}
