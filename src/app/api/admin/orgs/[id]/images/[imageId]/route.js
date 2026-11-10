import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { deletePrivate, getPrivate } from "@/lib/media/s3";
import { organizationImageKey, ORG_IMAGE_SIZES } from "@/lib/orgMedia";

export const runtime = "nodejs";
const ORG = /^c[a-z0-9]{10,40}$/;
const PHOTO = /^[0-9a-f-]{36}$/i;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function access(params) {
    const user = await getCurrentUser();
    const { id, imageId } = await params;
    return { user, id, imageId, valid: ORG.test(id) && PHOTO.test(imageId) };
}

export async function GET(request, { params }) {
    const { user, id, imageId, valid } = await access(params);
    if (!user) return new Response(null, { status: 401 });
    if (user.role !== "ADMIN" || !valid) return new Response(null, { status: 404 });
    const size = Number(new URL(request.url).searchParams.get("size") || 320);
    if (!ORG_IMAGE_SIZES.includes(size)) return new Response(null, { status: 400 });
    try {
        const image = await getPrisma().orgImage.findFirst({ where: { id: imageId, orgId: id },
            select: { id: true, storageKey: true } });
        if (!image) return new Response(null, { status: 404 });
        const key = `${organizationImageKey(id, image)}/${size}.webp`;
        const object = await getPrivate(key);
        if (!object.Body) return new Response(null, { status: 404 });
        return new Response(await object.Body.transformToByteArray(), { headers: {
            "Content-Type": "image/webp", "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        } });
    } catch (error) {
        console.error("Organization private image read failed", { code: error?.code ?? "unknown" });
        return new Response(null, { status: 503 });
    }
}

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const { user, id, imageId, valid } = await access(params);
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    if (!valid) return fail("Фотография не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 5000) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    const action = input?.action;
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        !["metadata", "logo", "cover", "clearLogo", "clearCover"].includes(action)) {
        return fail("Неизвестное действие.", 400);
    }
    if (action === "metadata" && (typeof input.caption !== "string" || input.caption.trim().length > 240 ||
        typeof input.credit !== "string" || input.credit.trim().length > 240 ||
        typeof input.rightsNote !== "string" || input.rightsNote.trim().length > 1000)) {
        return fail("Проверьте подпись, автора и права на фотографию.", 400);
    }
    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const changed = await tx.organization.updateMany({ where: { id, status: "DRAFT" },
                data: { updatedAt: new Date() } });
            if (changed.count !== 1) return null;
            const image = await tx.orgImage.findFirst({ where: { id: imageId, orgId: id }, select: { id: true } });
            if (!image) return null;
            if (action === "metadata") {
                const saved = await tx.orgImage.update({ where: { id: imageId },
                    data: { caption: input.caption.trim() || null, credit: input.credit.trim() || null,
                        rightsNote: input.rightsNote.trim() || null },
                    select: { id: true, caption: true, credit: true, rightsNote: true },
                });
                return { image: saved };
            }
            const field = action.toLowerCase().includes("logo") ? "logoImageId" : "coverImageId";
            await tx.organization.update({ where: { id }, data: { [field]: action.startsWith("clear") ? null : imageId } });
            return { role: field, imageId: action.startsWith("clear") ? null : imageId };
        });
        if (!result) return fail("Карточка или фото недоступны для редактирования.", 409);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Organization image change failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось изменить фотографию.", 503);
    }
}

export async function DELETE(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const { user, id, imageId, valid } = await access(params);
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    if (!valid) return fail("Фотография не найдена.", 404);
    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const changed = await tx.organization.updateMany({ where: { id, status: "DRAFT" },
                data: { updatedAt: new Date() } });
            if (changed.count !== 1) return null;
            const image = await tx.orgImage.findFirst({ where: { id: imageId, orgId: id },
                select: { id: true, storageKey: true } });
            if (!image) return null;
            await tx.orgImage.delete({ where: { id: imageId } });
            const org = await tx.organization.findUnique({ where: { id },
                select: { logoImageId: true, coverImageId: true } });
            await tx.organization.update({ where: { id }, data: {
                ...(org.logoImageId === imageId ? { logoImageId: null } : {}),
                ...(org.coverImageId === imageId ? { coverImageId: null } : {}),
            } });
            return { key: organizationImageKey(id, image) };
        });
        if (!result) return fail("Карточка или фото недоступны для удаления.", 409);
        const keys = [`${result.key}/original.jpg`, `${result.key}/original.png`, `${result.key}/original.webp`,
            ...ORG_IMAGE_SIZES.map(size => `${result.key}/${size}.webp`)];
        const cleanup = await Promise.allSettled(keys.map(key => deletePrivate(key)));
        const pending = cleanup.some(item => item.status === "rejected");
        if (pending) console.error("Organization private image cleanup incomplete", { id, imageId });
        return NextResponse.json({ removed: true, storageCleanupPending: pending },
            { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Organization image removal failed", { code: error?.code ?? "unknown" });
        return fail("Не удалось удалить фотографию.", 503);
    }
}
