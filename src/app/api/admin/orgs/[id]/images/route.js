import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { InvalidMediaError, cleanupPrivateKeys, uploadPrivateImageSet } from "@/lib/media/images";
import { ORG_IMAGE_LIMIT } from "@/lib/orgMedia";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const MAX_SIZE = 5 * 1024 * 1024;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Организация не найдена.", 404);
    const length = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(length) || length <= 0) return fail("Укажите размер запроса.", 411);
    if (length > MAX_SIZE + 128 * 1024) return fail("Фотография превышает 5 МБ.", 413);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) return fail("Ожидается файл.", 415);
    const prisma = getPrisma();
    try {
        const org = await prisma.organization.findUnique({ where: { id }, select: { status: true } });
        if (!org) return fail("Организация не найдена.", 404);
        if (org.status !== "DRAFT") return fail("Сначала снимите карточку с публикации.", 409);
        const data = await request.formData();
        const file = data.get("file");
        if (!file || typeof file.arrayBuffer !== "function" || typeof file.size !== "number" ||
            file.size < 1 || file.size > MAX_SIZE) return fail("JPEG, PNG или WebP до 5 МБ.", 400);
        const stored = await uploadPrivateImageSet({ bytes: Buffer.from(await file.arrayBuffer()), area: "orgs", entityId: id });
        try {
            const result = await prisma.$transaction(async (tx) => {
                const changed = await tx.organization.updateMany({
                    where: { id, status: "DRAFT" }, data: { updatedAt: new Date() },
                });
                if (changed.count !== 1) throw new InvalidMediaError("Карточка уже опубликована.");
                const count = await tx.orgImage.count({ where: { orgId: id } });
                if (count >= ORG_IMAGE_LIMIT) throw new InvalidMediaError("Допустимо не более 12 изображений.");
                const image = await tx.orgImage.create({
                    data: { id: stored.photoId, orgId: id, storageKey: stored.baseKey, sortOrder: count },
                    select: { id: true, caption: true, credit: true, rightsNote: true, sortOrder: true },
                });
                return { image };
            });
            return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
        } catch (error) {
            await cleanupPrivateKeys(stored.storedKeys);
            throw error;
        }
    } catch (error) {
        if (error instanceof InvalidMediaError) return fail(error.message, 400);
        console.error("Organization image upload failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось загрузить фотографию.", 503);
    }
}
