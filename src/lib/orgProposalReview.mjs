import { PROPOSAL_FIELDS, validateOrgProposalFields, sameProposalFields } from "./orgProposal.mjs";

export const PROPOSAL_REVIEW_ACTIONS = Object.freeze({ approve: "APPROVED", return: "RETURNED" });
export const PROPOSAL_REVIEW_STATUS_RU = Object.freeze({
    DRAFT: "Черновик", SUBMITTED: "На рассмотрении", RETURNED: "Возвращено на доработку",
    APPROVED: "Одобрено и опубликовано", REJECTED: "Отклонено", CANCELLED: "Отменено",
});
export const PROPOSAL_FIELD_LABELS = Object.freeze({
    title: "Название", type: "Тип / направление", category: "Категория",
    area: "Территория", locality: "Населённый пункт", address: "Адрес",
    phone: "Телефон", hours: "Режим работы", tags: "Теги", services: "Услуги",
    website: "Сайт", email: "E-mail", mapUrl: "Карта", vkUrl: "ВКонтакте",
    okUrl: "Одноклассники", maxUrl: "MAX", content: "Описание",
});

export function validateOrgProposalReviewInput(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).length !== 3 ||
        Object.keys(value).some(key => !["action", "note", "expectedUpdatedAt"].includes(key)) ||
        !Object.hasOwn(PROPOSAL_REVIEW_ACTIONS, value.action) ||
        typeof value.expectedUpdatedAt !== "string" ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.expectedUpdatedAt) ||
        !Number.isFinite(Date.parse(value.expectedUpdatedAt)) ||
        new Date(value.expectedUpdatedAt).toISOString() !== value.expectedUpdatedAt ||
        typeof value.note !== "string" || value.note.length > 1500) return null;
    const note = value.note.normalize("NFC").trim().replace(/\s+/gu, " ");
    if (note.length < 10 || note.length > 1000 ||
        /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(note)) return null;
    return { action: value.action, note, expectedUpdatedAt: value.expectedUpdatedAt };
}

export function mayApproveOrgProposal({ proposal, organization, claim, requester }) {
    return Boolean(proposal?.status === "SUBMITTED" && organization?.status === "PUBLISHED" &&
        claim?.id === proposal.claimId && claim?.status === "APPROVED" &&
        claim?.orgId === proposal.orgId && claim?.requesterId === proposal.requesterId &&
        requester?.id === proposal.requesterId && !requester.archivedAt &&
        organization.updatedAt && proposal.baseOrgUpdatedAt &&
        new Date(organization.updatedAt).getTime() === new Date(proposal.baseOrgUpdatedAt).getTime() &&
        validateOrgProposalFields(proposal.fields) &&
        !sameProposalFields(proposal.fields, proposal.baseFields));
}

export function proposalChangedFields(before, after) {
    if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
    return PROPOSAL_FIELDS.filter(key =>
        JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => ({
            key, label: PROPOSAL_FIELD_LABELS[key], before: before[key], after: after[key],
        }));
}

export function showProposalField(value) {
    if (Array.isArray(value)) return value.join("\n");
    return typeof value === "string" ? value : "";
}
