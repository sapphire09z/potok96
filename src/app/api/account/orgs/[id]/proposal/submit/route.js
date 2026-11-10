import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { ORG_ID, isIsoVersion, canEditOrgProposal,
    sameProposalFields } from "@/lib/orgProposal.mjs";

export const runtime = "nodejs";
const reply = (payload, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!ORG_ID.test(id)) return reply({ error: "Организация не найдена." }, 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Ожидается JSON." }, 415);
    let data;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 500) return reply({ error: "Слишком большой запрос." }, 413);
        data = JSON.parse(raw);
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        Object.keys(data).length !== 1 || !isIsoVersion(data.expectedProposalUpdatedAt)) {
        return reply({ error: "Некорректная версия черновика." }, 400);
    }
    try {
        const result = await getPrisma().$transaction(async tx => {
            const [account, org, claim] = await Promise.all([
                tx.user.findUnique({ where: { id: actor.id }, select: { id: true, archivedAt: true } }),
                tx.organization.findUnique({ where: { id }, select: { id: true, status: true, updatedAt: true } }),
                tx.orgClaim.findFirst({ where: { orgId: id, requesterId: actor.id, status: "APPROVED" },
                    select: { id: true, orgId: true, requesterId: true, status: true } }),
            ]);
            if (!canEditOrgProposal({ actor: account, org, claim })) return { error: "Полномочия отсутствуют или отозваны.", status: 403 };
            const proposal = await tx.orgEditProposal.findFirst({ where: {
                orgId: id, claimId: claim.id, requesterId: actor.id, status: "DRAFT",
            } });
            if (!proposal || proposal.updatedAt.toISOString() !== data.expectedProposalUpdatedAt) {
                return { error: "Черновик отсутствует или изменился. Обновите страницу.", status: 409 };
            }
            if (org.updatedAt.getTime() !== proposal.baseOrgUpdatedAt.getTime()) {
                return { error: "Опубликованная карточка изменилась после создания черновика. Удалите старый черновик и создайте новый.", status: 409 };
            }
            if (sameProposalFields(proposal.fields, proposal.baseFields)) {
                return { error: "Изменений нет. Укажите, что нужно исправить.", status: 400 };
            }
            const changed = await tx.orgEditProposal.updateMany({ where: {
                id: proposal.id, updatedAt: proposal.updatedAt, status: "DRAFT",
            }, data: { status: "SUBMITTED", submittedAt: new Date() } });
            return changed.count === 1 ? { success: true } : { error: "Предложение уже отправлено. Обновите страницу.", status: 409 };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        return result.error ? reply({ error: result.error }, result.status) : reply(result);
    } catch (error) {
        if (error?.code === "P2034") return reply({ error: "Предложение изменилось. Обновите страницу." }, 409);
        console.error("Org proposal submit failed", { code: error?.code || "unknown" });
        return reply({ error: "Не удалось отправить изменения." }, 503);
    }
}
