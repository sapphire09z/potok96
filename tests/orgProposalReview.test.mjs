import test from "node:test";
import assert from "node:assert/strict";
import { validateOrgProposalReviewInput, mayApproveOrgProposal,
    proposalChangedFields, showProposalField } from "../src/lib/orgProposalReview.mjs";
import { validateOrgProposalFields } from "../src/lib/orgProposal.mjs";

const example = {
    title: "Магазин", type: "", category: "shops", area: "city", locality: "Красноуфимск",
    address: "", phone: "", hours: "", tags: [], services: [], website: "",
    email: "", mapUrl: "", vkUrl: "", okUrl: "", maxUrl: "", content: "",
};
const date = "2026-11-11T03:30:15.000Z";

test("review input requires an explicit decision, audit note and exact optimistic version", () => {
    assert.deepEqual(validateOrgProposalReviewInput({ action: "return", note: "Нужен корректный телефон", expectedUpdatedAt: date }),
        { action: "return", note: "Нужен корректный телефон", expectedUpdatedAt: date });
    assert.equal(validateOrgProposalReviewInput({ action: "publish", note: "Проверено вручную", expectedUpdatedAt: date }), null);
    assert.equal(validateOrgProposalReviewInput({ action: "approve", note: "коротко", expectedUpdatedAt: date }), null);
    assert.equal(validateOrgProposalReviewInput({ action: "approve", note: "Проверено вручную", expectedUpdatedAt: date, role: "ADMIN" }), null);
    assert.equal(validateOrgProposalReviewInput({ action: "return", note: "Проверено вручную", expectedUpdatedAt: "invalid" }), null);
});

test("approval is blocked for revoked claims, archived accounts, changed public orgs and invalid payload", () => {
    const proposed = validateOrgProposalFields({ ...example, phone: "123" });
    const base = validateOrgProposalFields(example);
    assert.ok(proposed && base);
    const org = { status: "PUBLISHED", updatedAt: date };
    const claim = { id: "claim", status: "APPROVED", orgId: "org", requesterId: "user" };
    const requester = { id: "user", archivedAt: null };
    const proposal = { orgId: "org", requesterId: "user", claimId: "claim", status: "SUBMITTED",
        baseOrgUpdatedAt: date, fields: proposed, baseFields: base };
    assert.ok(mayApproveOrgProposal({ proposal, organization: org, claim, requester }));
    assert.ok(!mayApproveOrgProposal({ proposal, organization: { ...org, updatedAt: "2026-11-11T03:30:15.001Z" }, claim, requester }));
    assert.ok(!mayApproveOrgProposal({ proposal, organization: org, claim: { ...claim, status: "REVOKED" }, requester }));
    assert.ok(!mayApproveOrgProposal({ proposal, organization: org, claim, requester: { ...requester, archivedAt: date } }));
    assert.ok(!mayApproveOrgProposal({ proposal: { ...proposal, fields: { ...proposed, placement: "EXTENDED" } }, organization: org, claim, requester }));
    assert.ok(!mayApproveOrgProposal({ proposal: { ...proposal, fields: base }, organization: org, claim, requester }));
});

test("diff compares only safe whitelisted organization fields", () => {
    const before = { ...example, placement: "BASIC" };
    const after = { ...example, title: "Новый магазин", tags: ["сервис"], placement: "EXTENDED" };
    const changed = proposalChangedFields(before, after);
    assert.deepEqual(changed.map(x => x.key), ["title", "tags"]);
    assert.equal(showProposalField(changed[1].after), "сервис");
});
