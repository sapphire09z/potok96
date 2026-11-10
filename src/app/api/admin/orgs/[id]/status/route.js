import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { getPrisma } from "@/lib/prisma";
import { organizationSlugExists } from "@/lib/orgAdmin";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Организация не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Нужен JSON.", 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 500) return fail("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return fail("Некорректный JSON.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).some(key => !["action", "expectedUpdatedAt"].includes(key)) ||
        !["publish", "unpublish"].includes(input.action) ||
        typeof input.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
        return fail("Некорректные параметры.", 400);
    }
    const from = input.action === "publish" ? "DRAFT" : "PUBLISHED";
    const to = input.action === "publish" ? "PUBLISHED" : "DRAFT";
    const prisma = getPrisma();
    try {
        const item = await prisma.organization.findUnique({ where: { id },
            select: { id: true, slug: true, title: true, status: true, publishedAt: true } });
        if (!item) return fail("Организация не найдена.", 404);
        if (item.status !== from) return fail("Статус организации уже изменён.", 409);
        if (to === "PUBLISHED") {
            if (!item.title.trim()) return fail("Укажите название организации.", 422);
            if (await organizationSlugExists(item.slug, item.id)) return fail("Адрес страницы занят другой организацией.", 409);
        }
        const changed = await prisma.organization.updateMany({
            where: { id, status: from, updatedAt: new Date(input.expectedUpdatedAt) },
            data: { status: to, ...(to === "PUBLISHED" ? { publishedAt: item.publishedAt ?? new Date() } : {}) },
        });
        if (changed.count !== 1) return fail("Карточка изменилась. Обновите страницу.", 409);
        const latest = await prisma.organization.findUnique({ where: { id }, select: { updatedAt: true } });
        return NextResponse.json({ status: to, updatedAt: latest.updatedAt.toISOString() },
            { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Organization status failed", { code: error?.code || "unknown" });
        return fail("Не удалось изменить публикацию.", 503);
    }
}
