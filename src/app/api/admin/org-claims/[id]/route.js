import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { CLAIM_ID, validateOrgClaimDecision } from "@/lib/orgClaims.mjs";

export const runtime = "nodejs";
const respond = (payload, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return respond({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return respond({ error: "Войдите в аккаунт." }, 401);
    if (actor.role !== "ADMIN") return respond({ error: "Доступ запрещён." }, 403);
    const { id } = await params;
    if (!CLAIM_ID.test(id)) return respond({ error: "Заявка не найдена." }, 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "Нужен JSON." }, 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 1500) return respond({ error: "Слишком большой запрос." }, 413);
        input = validateOrgClaimDecision(JSON.parse(raw));
    } catch { return respond({ error: "Некорректный JSON." }, 400); }
    if (!input) return respond({ error: "Укажите решение и комментарий проверки (не менее 10 символов)." }, 400);

    const from = input.action === "revoke" ? "APPROVED" : "PENDING";
    const to = { approve: "APPROVED", reject: "REJECTED", revoke: "REVOKED" }[input.action];
    try {
        const result = await getPrisma().$transaction(async (tx) => {
            const admin = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, archivedAt: true } });
            if (admin?.role !== "ADMIN" || admin.archivedAt) return { error: "Права администратора изменились.", status: 403 };
            const claim = await tx.orgClaim.findUnique({ where: { id }, include: {
                organization: { select: { id: true, status: true } },
                requester: { select: { archivedAt: true } },
            } });
            if (!claim) return { error: "Заявка не найдена.", status: 404 };
            if (claim.status !== from) return { error: "Статус заявки уже изменился.", status: 409 };
            if (input.action === "approve" && (claim.organization.status !== "PUBLISHED" || claim.requester.archivedAt)) {
                return { error: "Нельзя подтвердить доступ к неопубликованной организации или архивному аккаунту.", status: 409 };
            }
            const now = new Date();
            const fields = input.action === "revoke"
                ? { revokedAt: now, revokedById: actor.id, revocationNote: input.note }
                : { reviewedAt: now, reviewedById: actor.id, reviewNote: input.note };
            const change = await tx.orgClaim.updateMany({ where: { id, status: from }, data: { status: to, ...fields } });
            if (change.count !== 1) return { error: "Заявка изменилась. Обновите страницу.", status: 409 };
            if (input.action === "revoke") {
                // Revoke cancels any unpublished draft/submission atomically, including
                // proposals saved in a concurrent session. No lingering access.
                await tx.orgEditProposal.updateMany({ where: {
                    claimId: claim.id, status: { in: ["DRAFT", "SUBMITTED", "RETURNED"] },
                }, data: { status: "CANCELLED" } });
            }
            return { status: to };
        }, { isolationLevel: "Serializable", timeout: 10000 });
        if (result.error) return respond({ error: result.error }, result.status);
        return respond({ success: true, status: result.status });
    } catch (error) {
        if (error?.code === "P2002") return respond({ error: "У этой организации уже есть действующий представитель." }, 409);
        if (error?.code === "P2034") return respond({ error: "Заявка изменилась. Обновите страницу." }, 409);
        console.error("Organization claim review failed", { code: error?.code ?? "unknown" });
        return respond({ error: "Не удалось сохранить решение." }, 503);
    }
}
