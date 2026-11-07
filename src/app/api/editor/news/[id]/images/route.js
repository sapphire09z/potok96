import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isNewsEditor } from "@/lib/newsDraft";
import { InvalidMediaError, cleanupPrivateKeys, uploadPrivateImageSet } from "@/lib/media/images";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 12;
const ID_PATTERN = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (!isNewsEditor(user)) return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID_PATTERN.test(id)) return fail("Новость не найдена.", 404);
    const contentLength = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) return fail("Нужен размер запроса.", 411);
    if (contentLength > MAX_BYTES + 128 * 1024) return fail("Файл слишком большой.", 413);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return fail("Ожидается файл.", 415);

    const prisma = getPrisma();
    try {
        const post = await prisma.newsPost.findUnique({ where: { id }, select: { status: true } });
        if (!post) return fail("Новость не найдена.", 404);
        if (post.status !== "DRAFT") return fail("Редактирование фотографии недоступно.", 409);
        const body = await request.formData();
        const file = body.get("file");
        if (!file || typeof file.arrayBuffer !== "function" ||
            typeof file.size !== "number" || file.size < 1 || file.size > MAX_BYTES) {
            return fail("Выберите JPEG, PNG или WebP до 5 МБ.", 400);
        }
        const bytes = Buffer.from(await file.arrayBuffer());
        const stored = await uploadPrivateImageSet({ bytes, area: "news", entityId: id });
        try {
            const result = await prisma.$transaction(async (tx) => {
                const locked = await tx.newsPost.updateMany({
                    where: { id, status: "DRAFT" }, data: { updatedAt: new Date() },
                });
                if (locked.count !== 1) throw new InvalidMediaError("Статус новости изменился.");
                const count = await tx.newsImage.count({ where: { postId: id } });
                if (count >= MAX_PHOTOS) throw new InvalidMediaError("Не более 12 фотографий.");
                const image = await tx.newsImage.create({
                    data: { id: stored.photoId, postId: id, storageKey: stored.baseKey, sortOrder: count },
                    select: { id: true, sortOrder: true, caption: true, credit: true, rightsNote: true },
                });
                if (count === 0) {
                    await tx.newsPost.update({ where: { id }, data: { coverImageId: image.id } });
                }
                return { image, coverImageId: count === 0 ? image.id : null };
            });
            return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
        } catch (error) {
            await cleanupPrivateKeys(stored.storedKeys);
            throw error;
        }
    } catch (error) {
        if (error instanceof InvalidMediaError) return fail(error.message, 400);
        console.error("News image upload failed", error);
        return fail("Не удалось загрузить фотографию.", 503);
    }
}
