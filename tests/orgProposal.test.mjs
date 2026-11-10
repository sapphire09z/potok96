import test from "node:test";
import assert from "node:assert/strict";
import { validateOrgProposalFields, snapshotOrgFields, canEditOrgProposal,
    isIsoVersion, sameProposalFields, PROPOSAL_FIELDS } from "../src/lib/orgProposal.mjs";
const fields = {
    title: "Тестовая организация", type: "Магазин", category: "shops", area: "city",
    locality: "Красноуфимск", address: "ул. Тестовая, 1", phone: "+7 999 999-99-99",
    hours: "Пн–Пт: 10–18", tags: ["покупки"], services: ["Доставка"],
    website: "https://example.org/", email: "test@example.org", mapUrl: "",
    vkUrl: "", okUrl: "", maxUrl: "", content: "Описание\n\nВторая строка",
};

test("draft accepts valid public fields and freezes the exact allowed field set", () => {
    assert.deepEqual(Object.keys(snapshotOrgFields(fields)), PROPOSAL_FIELDS);
    assert.deepEqual(validateOrgProposalFields(fields), fields);
    assert.equal(validateOrgProposalFields({ ...fields, placement: "EXTENDED" }), null);
    assert.equal(validateOrgProposalFields({ ...fields, slug: "other" }), null);
    assert.equal(validateOrgProposalFields({ ...fields, status: "PUBLISHED" }), null);
    assert.equal(validateOrgProposalFields({ ...fields, logo: "/media/orgs/other.png" }), null);
});

test("rejects malicious or oversized content, unsupported URLs and invalid dates", () => {
    assert.equal(validateOrgProposalFields({ ...fields, website: "javascript:alert(1)" }), null);
    assert.equal(validateOrgProposalFields({ ...fields, website: "http://example.org" }), null);
    assert.equal(validateOrgProposalFields({ ...fields, title: "x".repeat(161) }), null);
    assert.equal(validateOrgProposalFields({ ...fields, services: Array(25).fill("a") }), null);
    assert.equal(validateOrgProposalFields({ ...fields, category: "secret" }), null);
    assert.equal(validateOrgProposalFields({ ...fields, content: "x\u202eevil" }), null);
    assert.equal(validateOrgProposalFields({ ...fields, email: "wrong" }), null);
    assert.equal(isIsoVersion("2026-11-10T09:00:00.000Z"), true);
    assert.equal(isIsoVersion("2026-02-30T09:00:00.000Z"), false);
});

test("checks approved representative, published org and nonarchived account", () => {
    const actor = { id: "user1", archivedAt: null };
    const org = { id: "org1", status: "PUBLISHED" };
    const claim = { requesterId: "user1", orgId: "org1", status: "APPROVED" };
    assert.equal(canEditOrgProposal({ actor, org, claim }), true);
    assert.equal(canEditOrgProposal({ actor, org, claim: { ...claim, status: "REVOKED" } }), false);
    assert.equal(canEditOrgProposal({ actor, org, claim: { ...claim, requesterId: "other" } }), false);
    assert.equal(canEditOrgProposal({ actor, org: { ...org, status: "DRAFT" }, claim }), false);
    assert.equal(canEditOrgProposal({ actor: { ...actor, archivedAt: new Date() }, org, claim }), false);
});

test("detects meaningful changes before submission", () => {
    assert.equal(sameProposalFields(fields, { ...fields }), true);
    assert.equal(sameProposalFields(fields, { ...fields, phone: "123" }), false);
});
