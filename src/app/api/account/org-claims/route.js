import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { validateOrgClaimRequest } from "@/lib/orgClaims.mjs";

export const runtime = "nodejs";
const reply = (payload, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Нужен JSON." }, 415);
    let data;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 3000) return reply({ error: "Слишком большой запрос." }, 413);
        data = validateOrgClaimRequest(JSON.parse(raw));
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!data) return reply({ error: "Укажите должность и способ подтверждения полномочий." }, 400);

    try {
        const prisma = getPrisma();
        const result = await prisma.$transaction(async (tx) => {
            const account = await tx.user.findUnique({ where: { id: actor.id }, select: { archivedAt: true, phone: true } });
            if (!account || account.archivedAt || !account.phone) return { error: "Учётная запись недоступна.", status: 403 };
            const org = await tx.organization.findUnique({ where: { id: data.orgId }, select: { id: true, status: true } });
            if (!org || org.status !== "PUBLISHED") return { error: "Организация не найдена в опубликованном справочнике.", status: 404 };
            const approved = await tx.orgClaim.findFirst({ where: { orgId: data.orgId, status: "APPROVED" }, select: { requesterId: true } });
            if (approved) return { error: approved.requesterId === actor.id ? "Вы уже представляете эту организацию." : "У организации уже есть подтверждённый представитель.", status: 409 };
            const duplicate = await tx.orgClaim.findFirst({ where: { orgId: data.orgId, requesterId: actor.id, status: "PENDING" }, select: { id: true } });
            if (duplicate) return { error: "Ваша заявка уже находится на проверке.", status: 409 };
            const pendingTotal = await tx.orgClaim.count({ where: { requesterId: actor.id, status: "PENDING" } });
            if (pendingTotal >= 3) return { error: "Допустимо не более трёх заявок одновременно.", status: 429 };
            const pendingForOrg = await tx.orgClaim.count({ where: { orgId: data.orgId, status: "PENDING" } });
            if (pendingForOrg >= 10) return { error: "Временно достигнут лимит заявок на эту организацию.", status: 429 };
            const today = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const daily = await tx.orgClaim.count({ where: { requesterId: actor.id, createdAt: { gte: today } } });
            if (daily >= 5) return { error: "Слишком много заявок за сутки. Повторите позже.", status: 429 };
            const item = await tx.orgClaim.create({ data: {
                orgId: data.orgId, requesterId: actor.id, roleDescription: data.roleDescription,
                evidenceNote: data.evidenceNote,
            }, select: { id: true } });
            return { id: item.id };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return reply({ error: result.error }, result.status);
        return reply({ success: true, id: result.id }, 201);
    } catch (error) {
        if (error?.code === "P2002") return reply({ error: "Заявка уже создана." }, 409);
        if (error?.code === "P2034") return reply({ error: "Данные изменились. Повторите попытку." }, 409);
        console.error("Organization claim create failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось отправить заявку." }, 503);
    }
}
