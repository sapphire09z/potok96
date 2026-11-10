import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { ORG_ID, isIsoVersion, canEditOrgProposal, snapshotOrgFields,
    validateOrgProposalFields } from "@/lib/orgProposal.mjs";

export const runtime = "nodejs";
const reply = (payload, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });

async function parse(request, limit = 35000) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return { error: "Ожидается JSON.", status: 415 };
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > limit) return { error: "Слишком большой запрос.", status: 413 };
        return { body: JSON.parse(raw) };
    } catch { return { error: "Некорректный JSON.", status: 400 }; }
}

async function context(tx, id, actor) {
    const [account, org, claim] = await Promise.all([
        tx.user.findUnique({ where: { id: actor.id }, select: { id: true, archivedAt: true } }),
        tx.organization.findUnique({ where: { id } }),
        tx.orgClaim.findFirst({ where: { orgId: id, requesterId: actor.id, status: "APPROVED" },
            select: { id: true, orgId: true, requesterId: true, status: true } }),
    ]);
    return canEditOrgProposal({ actor: account, org, claim }) ? { org, claim } : null;
}

export async function PUT(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!ORG_ID.test(id)) return reply({ error: "Организация не найдена." }, 404);
    const parsed = await parse(request);
    if (parsed.error) return reply({ error: parsed.error }, parsed.status);
    const data = parsed.body;
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        Object.keys(data).length !== 2 || !Object.hasOwn(data, "fields") ||
        !Object.hasOwn(data, "expectedProposalUpdatedAt") ||
        !(data.expectedProposalUpdatedAt === null || isIsoVersion(data.expectedProposalUpdatedAt))) {
        return reply({ error: "Некорректная версия черновика." }, 400);
    }
    const fields = validateOrgProposalFields(data.fields);
    if (!fields) return reply({ error: "Проверьте поля организации. Дополнительные поля запрещены." }, 400);
    try {
        const result = await getPrisma().$transaction(async tx => {
            const access = await context(tx, id, actor);
            if (!access) return { error: "Нет подтверждённых полномочий на эту организацию.", status: 403 };
            const existing = await tx.orgEditProposal.findFirst({ where: { orgId: id, status: { in: ["DRAFT", "SUBMITTED"] } },
                orderBy: { createdAt: "desc" } });
            if (existing && (existing.requesterId !== actor.id || existing.claimId !== access.claim.id)) {
                return { error: "Карточка уже имеет активное предложение изменений.", status: 409 };
            }
            if (existing?.status === "SUBMITTED") return { error: "Предложение уже отправлено на рассмотрение.", status: 409 };
            if (existing) {
                if (data.expectedProposalUpdatedAt !== existing.updatedAt.toISOString()) {
                    return { error: "Черновик изменился в другой вкладке. Обновите страницу.", status: 409 };
                }
                const changed = await tx.orgEditProposal.updateMany({ where: {
                    id: existing.id, updatedAt: existing.updatedAt, status: "DRAFT",
                }, data: { fields } });
                if (changed.count !== 1) return { error: "Черновик изменился. Обновите страницу.", status: 409 };
                const updated = await tx.orgEditProposal.findUnique({ where: { id: existing.id }, select: { updatedAt: true } });
                return { id: existing.id, updatedAt: updated.updatedAt.toISOString(), status: "DRAFT" };
            }
            if (data.expectedProposalUpdatedAt !== null) return { error: "Обновите страницу перед созданием черновика.", status: 409 };
            const created = await tx.orgEditProposal.create({ data: {
                orgId: id, requesterId: actor.id, claimId: access.claim.id,
                baseOrgUpdatedAt: access.org.updatedAt, baseFields: snapshotOrgFields(access.org),
                fields,
            }, select: { id: true, updatedAt: true } });
            return { id: created.id, updatedAt: created.updatedAt.toISOString(), status: "DRAFT" };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return reply({ error: result.error }, result.status);
        return reply({ success: true, ...result });
    } catch (error) {
        if (["P2034", "P2002"].includes(error?.code)) return reply({ error: "Предложение изменилось. Обновите страницу." }, 409);
        console.error("Org proposal draft failed", { code: error?.code || "unknown" });
        return reply({ error: "Не удалось сохранить черновик." }, 503);
    }
}

export async function DELETE(request, { params }) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const { id } = await params;
    if (!ORG_ID.test(id)) return reply({ error: "Организация не найдена." }, 404);
    const parsed = await parse(request, 500);
    if (parsed.error) return reply({ error: parsed.error }, parsed.status);
    const data = parsed.body;
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        Object.keys(data).length !== 1 || !isIsoVersion(data.expectedProposalUpdatedAt)) {
        return reply({ error: "Некорректная версия черновика." }, 400);
    }
    try {
        const result = await getPrisma().$transaction(async tx => {
            const access = await context(tx, id, actor);
            if (!access) return { error: "Нет подтверждённых полномочий.", status: 403 };
            const changed = await tx.orgEditProposal.updateMany({ where: {
                orgId: id, claimId: access.claim.id, requesterId: actor.id,
                status: "DRAFT", updatedAt: new Date(data.expectedProposalUpdatedAt),
            }, data: { status: "CANCELLED" } });
            return changed.count === 1 ? { success: true } : { error: "Черновик изменился. Обновите страницу.", status: 409 };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        return result.error ? reply({ error: result.error }, result.status) : reply(result);
    } catch (error) {
        if (error?.code === "P2034") return reply({ error: "Повторите попытку после обновления страницы." }, 409);
        console.error("Org proposal cancel failed", { code: error?.code || "unknown" });
        return reply({ error: "Не удалось удалить черновик." }, 503);
    }
}
