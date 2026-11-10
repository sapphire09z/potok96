import test from "node:test";
import assert from "node:assert/strict";
import { validateOrgClaimRequest, validateOrgClaimDecision, CLAIM_STATUS_RU } from "../src/lib/orgClaims.mjs";

const orgId = "cm25orgexample000001";

test("request requires valid org ID, role and evidence note", () => {
    const value = validateOrgClaimRequest({
        orgId, roleDescription: "Управляющий", evidenceNote: "Готов подтвердить право по официальному номеру организации",
    });
    assert.equal(value.orgId, orgId);
    assert.equal(value.roleDescription, "Управляющий");
    assert.equal(validateOrgClaimRequest({ orgId, roleDescription: "X", evidenceNote: "Подтвержу полномочия лично" }), null);
    assert.equal(validateOrgClaimRequest({ orgId: "../../x", roleDescription: "Директор", evidenceNote: "Подтвержу полномочия лично" }), null);
});

test("unknown keys and oversized content are rejected", () => {
    const base = { orgId, roleDescription: "Директор", evidenceNote: "Подтверждение по телефону организации" };
    assert.equal(validateOrgClaimRequest({ ...base, admin: true }), null);
    assert.equal(validateOrgClaimRequest({ ...base, evidenceNote: "X".repeat(2000) }), null);
    assert.equal(validateOrgClaimRequest({ ...base, roleDescription: "Директор\u0000" }), null);
});

test("review requires actionable decision and documented verification", () => {
    assert.deepEqual(validateOrgClaimDecision({ action: "approve", reviewNote: "Обратный звонок на официальный номер" }),
        { action: "approve", note: "Обратный звонок на официальный номер" });
    assert.equal(validateOrgClaimDecision({ action: "approve", reviewNote: "OK" }), null);
    assert.equal(validateOrgClaimDecision({ action: "owner", reviewNote: "Проверено по телефону" }), null);
    assert.equal(validateOrgClaimDecision({ action: "reject", reviewNote: "Нет подтверждения", grantRole: "ADMIN" }), null);
    assert.equal(CLAIM_STATUS_RU.REVOKED, "Доступ отозван");
});
