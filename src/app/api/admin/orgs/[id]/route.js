import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { getPrisma } from "@/lib/prisma";
import { organizationSlugExists, parseOrganizationRequest } from "@/lib/orgAdmin";

export const runtime = "nodejs";
const ID = /^c[a-z0-9]{10,40}$/;
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const { id } = await params;
    if (!ID.test(id)) return fail("Организация не найдена.", 404);
    const version = request.headers.get("x-expected-updated-at");
    if (!version || !Number.isFinite(Date.parse(version))) return fail("Обновите страницу перед сохранением.", 400);
    const expected = new Date(version);
    const parsed = await parseOrganizationRequest(request);
    if (parsed.error) return fail(parsed.error, parsed.status);
    try {
        if (await organizationSlugExists(parsed.data.slug, id)) return fail("Этот адрес организации уже занят.", 409);
        const changed = await getPrisma().organization.updateMany({
            where: { id, status: "DRAFT", updatedAt: expected },
            data: parsed.data,
        });
        if (changed.count !== 1) return fail("Карточка изменилась или опубликована. Обновите страницу.", 409);
        const post = await getPrisma().organization.findUnique({ where: { id }, select: { updatedAt: true } });
        return NextResponse.json({ updatedAt: post.updatedAt.toISOString() },
            { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error?.code === "P2002") return fail("Адрес организации уже занят.", 409);
        console.error("Update organization failed", { code: error?.code || "unknown" });
        return fail("Не удалось сохранить карточку.", 503);
    }
}
