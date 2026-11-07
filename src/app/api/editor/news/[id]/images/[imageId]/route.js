import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isNewsEditor } from "@/lib/newsDraft";
import { getPrivate, deletePrivate } from "@/lib/media/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const POST_PATTERN = /^c[a-z0-9]{10,40}$/;
const PHOTO_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIZES = new Set(["320", "640", "960", "1440"]);
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function authorized(params) {
    const user = await getCurrentUser();
    const ids = await params;
    return { user, ...ids, valid: POST_PATTERN.test(ids.id) && PHOTO_PATTERN.test(ids.imageId) };
}

export async function GET(request, { params }) {
    const { user, id, imageId, valid } = await authorized(params);
    if (!user) return new Response(null, { status: 401 });
    if (!isNewsEditor(user) || !valid) return new Response(null, { status: 404 });
    const size = new URL(request.url).searchParams.get("size") ?? "320";
    if (!SIZES.has(size)) return new Response(null, { status: 400 });
    try {
        const image = await getPrisma().newsImage.findFirst({
            where: { id: imageId, postId: id }, select: { storageKey: true },
        });
        if (!image) return new Response(null, { status: 404 });
        const object = await getPrivate(`${image.storageKey}/${size}.webp`);
        const bytes = await object.Body.transformToByteArray();
        return new Response(bytes, {
            headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff" },
        });
    } catch (error) {
        console.error("News private image read failed", error);
        return new Response(null, { status: 503 });
    }
}

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const { user, id, imageId, valid } = await authorized(params);
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (!isNewsEditor(user)) return fail("Доступ запрещён.", 403);
    if (!valid) return fail("Фотография не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 5000) return fail("Слишком большой запрос.", 413);
    let data;
    try { data = JSON.parse(raw); } catch { return fail("Некорректный JSON.", 400); }
    if (data?.action !== "cover" && data?.action !== "metadata") return fail("Неизвестное действие.", 400);
    const fields = ["caption", "credit", "rightsNote"];
    const limits = [240, 240, 1000];
    if (data.action === "metadata" && fields.some((field, index) =>
        typeof data[field] !== "string" || data[field].trim().length > limits[index])) {
        return fail("Проверьте подпись, автора и разрешение.", 400);
    }
    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const post = await tx.newsPost.findFirst({ where: { id, status: "DRAFT" }, select: { id: true } });
            if (!post) return null;
            const locked = await tx.newsPost.updateMany({
                where: { id, status: "DRAFT" }, data: { updatedAt: new Date() },
            });
            if (locked.count !== 1) return null;
            const image = await tx.newsImage.findFirst({ where: { id: imageId, postId: id }, select: { id: true } });
            if (!image) return null;
            if (data.action === "cover") {
                await tx.newsPost.update({ where: { id }, data: { coverImageId: imageId } });
                return { coverImageId: imageId };
            }
            const updated = await tx.newsImage.update({
                where: { id: imageId },
                data: Object.fromEntries(fields.map((field) => [field, data[field].trim() || null])),
                select: { id: true, caption: true, credit: true, rightsNote: true },
            });
            return { image: updated };
        });
        if (!result) return fail("Черновик или фотография не найдены.", 404);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News image update failed", error);
        return fail("Не удалось обновить фотографию.", 503);
    }
}

export async function DELETE(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const { user, id, imageId, valid } = await authorized(params);
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (!isNewsEditor(user)) return fail("Доступ запрещён.", 403);
    if (!valid) return fail("Фотография не найдена.", 404);
    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const locked = await tx.newsPost.updateMany({
                where: { id, status: "DRAFT" }, data: { updatedAt: new Date() },
            });
            if (locked.count !== 1) return { error: "Черновик не найден или изменён.", status: 409 };
            const post = await tx.newsPost.findUnique({
                where: { id }, select: { id: true, body: true, coverImageId: true },
            });
            const photo = await tx.newsImage.findFirst({
                where: { id: imageId, postId: id }, select: { storageKey: true },
            });
            if (!photo) return { error: "Фотография не найдена.", status: 404 };
            if (post.body.includes(`/api/editor/news/${id}/images/${imageId}`)) {
                return { error: "Сначала удалите фотографию из текста и сохраните черновик.", status: 409 };
            }
            await tx.newsImage.delete({ where: { id: imageId } });
            const remaining = await tx.newsImage.findMany({
                where: { postId: id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: { id: true, sortOrder: true },
            });
            for (const [index, item] of remaining.entries()) {
                if (item.sortOrder !== index) await tx.newsImage.update({ where: { id: item.id }, data: { sortOrder: index } });
            }
            const coverImageId = post.coverImageId === imageId ? (remaining[0]?.id ?? null) : post.coverImageId;
            await tx.newsPost.update({ where: { id }, data: { coverImageId } });
            return { storageKey: photo.storageKey, coverImageId };
        });
        if (result.error) return fail(result.error, result.status);
        const keys = [
            `${result.storageKey}/original.jpg`, `${result.storageKey}/original.png`, `${result.storageKey}/original.webp`,
            ...[320, 640, 960, 1440].map((size) => `${result.storageKey}/${size}.webp`),
        ];
        const cleanup = await Promise.allSettled(keys.map((key) => deletePrivate(key)));
        const failed = cleanup.filter((item) => item.status === "rejected").length;
        if (failed) console.error("News image cleanup incomplete", { imageId, failed });
        return NextResponse.json({ coverImageId: result.coverImageId, storageCleanupPending: failed > 0 },
            { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News image removal failed", error);
        return fail("Не удалось удалить фотографию.", 503);
    }
}
