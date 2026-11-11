import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { ORG_ID, validateOrgProposalFields } from "@/lib/orgProposal.mjs";
import { validateOrgProposalReviewInput, mayApproveOrgProposal } from "@/lib/orgProposalReview.mjs";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    if (actor.role !== "ADMIN") return reply({ error: "Доступ запрещён." }, 403);
    const { id } = await params;
    if (!ORG_ID.test(id)) return reply({ error: "Предложение не найдено." }, 404);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Нужен JSON." }, 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 2500) return reply({ error: "Слишком большой запрос." }, 413);
        input = validateOrgProposalReviewInput(JSON.parse(raw));
    } catch { return reply({ error: "Некорректный JSON." }, 400); }
    if (!input) return reply({ error: "Укажите решение и причину (от 10 до 1000 символов)." }, 400);

    try {
        const result = await getPrisma().$transaction(async tx => {
            const admin = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, archivedAt: true } });
            if (admin?.role !== "ADMIN" || admin.archivedAt)
                return { error: "Права администратора изменились.", status: 403 };
            const proposal = await tx.orgEditProposal.findUnique({ where: { id }, include: {
                organization: { select: { id: true, status: true, updatedAt: true } },
                requester: { select: { id: true, archivedAt: true } },
                claim: { select: { id: true, orgId: true, requesterId: true, status: true } },
            } });
            if (!proposal) return { error: "Предложение не найдено.", status: 404 };
            if (proposal.status !== "SUBMITTED" ||
                proposal.updatedAt.toISOString() !== input.expectedUpdatedAt)
                return { error: "Предложение уже изменилось. Обновите страницу.", status: 409 };

            if (input.action === "approve") {
                if (!mayApproveOrgProposal({ proposal, organization: proposal.organization,
                    claim: proposal.claim, requester: proposal.requester }))
                    return { error: "Публикация невозможна: изменена карточка, отозваны полномочия или данные некорректны. Верните предложение на доработку.", status: 409 };
                const fields = validateOrgProposalFields(proposal.fields);
                // Compare-and-swap prevents overwriting a newer public record.
                const changedOrg = await tx.organization.updateMany({ where: {
                    id: proposal.orgId, status: "PUBLISHED", updatedAt: proposal.baseOrgUpdatedAt,
                }, data: fields });
                if (changedOrg.count !== 1) return { error: "Опубликованная карточка изменилась. Нужна новая редакция.", status: 409 };
            }
            // Return deliberately does not modify the public organization.
            // The returned record can be corrected and resubmitted by its owner.
            const newStatus = input.action === "approve" ? "APPROVED" : "RETURNED";
            const changed = await tx.orgEditProposal.updateMany({ where: {
                id, status: "SUBMITTED", updatedAt: new Date(input.expectedUpdatedAt),
            }, data: {
                status: newStatus, reviewedAt: new Date(), reviewedById: actor.id, reviewNote: input.note,
            } });
            if (changed.count !== 1) return { error: "Предложение изменилось. Обновите страницу.", status: 409 };
            await tx.orgProposalReviewEvent.create({ data: {
                proposalId: id, reviewerId: actor.id, action: newStatus, note: input.note,
            } });
            return { success: true, status: newStatus };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        return result.error ? reply({ error: result.error }, result.status) : reply(result);
    } catch (error) {
        if (error?.code === "P2034") return reply({ error: "Конфликт одновременных изменений. Обновите страницу и повторите." }, 409);
        console.error("Organization proposal review failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось рассмотреть предложение." }, 503);
    }
}
