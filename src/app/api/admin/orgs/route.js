import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { getPrisma } from "@/lib/prisma";
import { organizationSlugExists, parseOrganizationRequest } from "@/lib/orgAdmin";

export const runtime = "nodejs";
const fail = (error, status) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
    if (!hasTrustedOrigin(request)) return fail("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return fail("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return fail("Доступ запрещён.", 403);
    const parsed = await parseOrganizationRequest(request);
    if (parsed.error) return fail(parsed.error, parsed.status);
    try {
        if (await organizationSlugExists(parsed.data.slug)) return fail("Этот адрес организации уже занят.", 409);
        const created = await getPrisma().organization.create({
            data: { ...parsed.data, createdById: user.id },
            select: { id: true, updatedAt: true },
        });
        return NextResponse.json({ id: created.id, updatedAt: created.updatedAt.toISOString() },
            { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error?.code === "P2002") return fail("Адрес организации уже занят.", 409);
        console.error("Create organization failed", { code: error?.code || "unknown" });
        return fail("Не удалось создать организацию.", 503);
    }
}
