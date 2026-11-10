const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
export const CLAIM_ID = /^c[a-z0-9]{10,40}$/;

function checkedText(value, min, max) {
    if (typeof value !== "string" || value.length > max * 2) return null;
    const text = value.normalize("NFC").trim().replace(/\s+/gu, " ");
    if (text.length < min || text.length > max || CONTROL.test(text)) return null;
    return text;
}

export function validateOrgClaimRequest(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some(key => !["orgId", "roleDescription", "evidenceNote"].includes(key))) return null;
    if (typeof value.orgId !== "string" || !CLAIM_ID.test(value.orgId)) return null;
    const roleDescription = checkedText(value.roleDescription, 4, 120);
    const evidenceNote = checkedText(value.evidenceNote, 15, 1000);
    return roleDescription && evidenceNote
        ? { orgId: value.orgId, roleDescription, evidenceNote }
        : null;
}

export function validateOrgClaimDecision(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some(key => !["action", "reviewNote"].includes(key))) return null;
    if (!["approve", "reject", "revoke"].includes(value.action)) return null;
    const note = checkedText(value.reviewNote, 10, 500);
    return note ? { action: value.action, note } : null;
}

export const CLAIM_STATUS_RU = {
    PENDING: "На проверке",
    APPROVED: "Доступ подтверждён",
    REJECTED: "Заявка отклонена",
    REVOKED: "Доступ отозван",
};
