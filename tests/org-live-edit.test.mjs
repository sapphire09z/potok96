import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    isEditableOrgStatus, canUpdateOrgSlug, validPublishedOrgImageRights,
} from "../src/lib/orgLiveEdit.mjs";

test("admins may edit both draft and published cards", () => {
    assert.equal(isEditableOrgStatus("DRAFT"), true);
    assert.equal(isEditableOrgStatus("PUBLISHED"), true);
});

test("unknown or absent statuses are not editable", () => {
    for (const status of ["ARCHIVED", "DELETED", "published", null, undefined]) {
        assert.equal(isEditableOrgStatus(status), false);
    }
});

test("draft slug can be corrected before publication", () => {
    assert.equal(canUpdateOrgSlug("DRAFT", "old-address", "new-address"), true);
});

test("published slug remains fixed even if title changes", () => {
    assert.equal(canUpdateOrgSlug("PUBLISHED", "old-address", "old-address"), true);
    assert.equal(canUpdateOrgSlug("PUBLISHED", "old-address", "new-address"), false);
});

test("an unsupported status cannot change or retain slug", () => {
    assert.equal(canUpdateOrgSlug("ARCHIVED", "same", "same"), false);
});

test("published upload requires credit and rights note", () => {
    assert.equal(validPublishedOrgImageRights("Photographer", "Owner permission"), true);
});

test("rights note may not be blank or whitespace", () => {
    assert.equal(validPublishedOrgImageRights("Photographer", "  "), false);
    assert.equal(validPublishedOrgImageRights(" ", "Owner permission"), false);
});

test("rights fields must be strings", () => {
    assert.equal(validPublishedOrgImageRights(null, "Permission"), false);
    assert.equal(validPublishedOrgImageRights("Photographer", undefined), false);
    assert.equal(validPublishedOrgImageRights(3, "Permission"), false);
});

test("rights fields enforce database column length", () => {
    assert.equal(validPublishedOrgImageRights("x".repeat(241), "Permission"), false);
    assert.equal(validPublishedOrgImageRights("Photographer", "x".repeat(1001)), false);
    assert.equal(validPublishedOrgImageRights("x".repeat(240), "x".repeat(1000)), true);
});

function source(path) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }

test("published organization updates retain optimistic version and status guards", () => {
    const route = source("src/app/api/admin/orgs/[id]/route.js");
    assert.match(route, /canUpdateOrgSlug\(original\.status, original\.slug, parsed\.data\.slug\)/);
    assert.match(route, /status: original\.status, updatedAt: expected/);
    assert.match(route, /original\.status === "PUBLISHED" \? \{ slug: original\.slug \}/);
});

test("published editor accepts saves, locks slug and keeps publication actions", () => {
    const editor = source("src/app/admin/orgs/OrganizationForm.jsx");
    assert.match(editor, /readOnly=\{published\}/);
    assert.match(editor, /published \? "Сохранить изменения"/);
    assert.match(editor, /router\.refresh\(\);/);
    assert.doesNotMatch(editor, /premiumDirty \|\| published/);
});

test("published image upload requires rights and promotes before persistence", () => {
    const api = source("src/app/api/admin/orgs/[id]/images/route.js");
    assert.match(api, /validPublishedOrgImageRights\(credit, rightsNote\)/);
    const promote = api.indexOf("if (published) await promoteOrganizationImages");
    const persist = api.indexOf("await tx.orgImage.create");
    assert.ok(promote >= 0 && persist > promote);
});

test("published image edit preserves rights and deletion cleans public files", () => {
    const api = source("src/app/api/admin/orgs/[id]/images/[imageId]/route.js");
    assert.match(api, /validPublishedOrgImageRights\(input\.credit, input\.rightsNote\)/);
    assert.match(api, /deletePublic\(`\$\{result\.key\}\/\$\{size\}\.webp`\)/);
});

test("published image uploader supplies rights in multipart form", () => {
    const manager = source("src/app/admin/orgs/OrganizationMediaManager.jsx");
    assert.match(manager, /body\.append\("credit", uploadCredit\.trim\(\)\)/);
    assert.match(manager, /body\.append\("rightsNote", uploadRightsNote\.trim\(\)\)/);
});
