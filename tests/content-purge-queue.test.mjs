import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePurgeAction, purgePreflightReport } from "../src/lib/contentPurgePolicy.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const time = "2026-11-18T01:00:00.000Z";
const id = "cm123456789abcde123456789";

test("request demands an explicit reason and exact material versions", () => {
  const okay = parsePurgeAction({ action: "request", expectedUpdatedAt: time,
    expectedTrashedAt: time, reason: "Пробный материал в корзине" });
  assert.equal(okay.action, "request");
  assert.equal(okay.trashedAt.toISOString(), time);
  assert.equal(parsePurgeAction({ action: "request", expectedUpdatedAt: time,
    expectedTrashedAt: time, reason: "кратко" }), null);
  assert.equal(parsePurgeAction({ action: "request", expectedUpdatedAt: time,
    expectedTrashedAt: "2026-11-18", reason: "Пробный материал" }), null);
});

test("only request, check and cancel are accepted", () => {
  for (const action of ["check", "cancel"]) {
    assert.equal(parsePurgeAction({ action, requestId: id, expectedRequestUpdatedAt: time })?.action, action);
  }
  for (const action of ["purge", "delete", "approve", "execute"]) {
    assert.equal(parsePurgeAction({ action, requestId: id, expectedRequestUpdatedAt: time }), null);
  }
  assert.equal(parsePurgeAction({ action: "cancel", requestId: id, expectedRequestUpdatedAt: time, extra: 1 }), null);
  assert.equal(parsePurgeAction({ action: "check", requestId: "bad", expectedRequestUpdatedAt: time }), null);
});

test("30-day waiting period always prevents any approval", () => {
  const item = { status: "TRASHED", trashedAt: new Date(time), images: [] };
  const request = { trashedAt: new Date(time) };
  const report = purgePreflightReport({ item, request, inventory: null, now: new Date("2026-11-19T01:00:00.000Z") });
  assert.equal(report.outcome, "WAITING");
  assert.equal(report.deletionAllowed, false);
  assert.equal(report.eligibleAt, "2026-12-18T01:00:00.000Z");
});

test("restored or re-trashed material invalidates a request", () => {
  const req = { trashedAt: new Date(time) };
  for (const item of [
    { status: "DRAFT", trashedAt: null },
    { status: "TRASHED", trashedAt: new Date("2026-11-19T01:00:00.000Z") },
  ]) {
    const report = purgePreflightReport({ item, request: req, inventory: null, now: new Date("2027-01-01T00:00:00.000Z") });
    assert.equal(report.outcome, "STALE");
    assert.equal(report.deletionAllowed, false);
  }
});

test("expired and complete inventory still requires separate backup/external review", () => {
  const item = { status: "TRASHED", trashedAt: new Date(time), images: [{ id: "a" }],
    _count: { comments: 3, workflowEvents: 2 } };
  const inventory = { listingComplete: true, hasUnexpected: false, invalidImages: [],
    privateSummary: { count: 3, bytes: 150 }, publicSummary: { count: 4, bytes: 600 } };
  const report = purgePreflightReport({ item, request: { trashedAt: new Date(time) }, inventory,
    now: new Date("2027-01-01T00:00:00.000Z") });
  assert.equal(report.outcome, "REVIEW");
  assert.equal(report.deletionAllowed, false);
  assert.equal(report.commentCount, 3);
  assert.equal(report.privateCount, 3);
  assert.match(report.issues.join(" "), /резервный архив/);
});

test("incomplete, unusual or corrupted S3 inventory is blocked", () => {
  const item = { status: "TRASHED", trashedAt: new Date(time), images: [] };
  const request = { trashedAt: new Date(time) };
  const after = new Date("2027-01-01T00:00:00.000Z");
  const base = { listingComplete: true, hasUnexpected: false, invalidImages: [],
    privateSummary: { count: 0, bytes: 0 }, publicSummary: { count: 0, bytes: 0 } };
  for (const inventory of [{ ...base, listingComplete: false }, { ...base, hasUnexpected: true },
    { ...base, invalidImages: ["unknown"] }]) {
    const report = purgePreflightReport({ item, request, inventory, now: after });
    assert.equal(report.outcome, "BLOCKED");
    assert.equal(report.deletionAllowed, false);
  }
});

test("queue migration and source have no destructive capabilities", () => {
  const sql = read("prisma/migrations/20261118200000_content_purge_queue/migration.sql");
  const route = read("src/app/api/admin/trash/purge/[kind]/[id]/route.js");
  const schema = read("prisma/schema.prisma");
  assert.match(sql, /CREATE TABLE "ContentPurgeRequest"/);
  assert.match(sql, /UNIQUE INDEX/);
  assert.match(schema, /model ContentPurgeRequest \{/);
  assert.match(route, /hasTrustedOrigin\(request\)/);
  assert.match(route, /account\?\.role !== "ADMIN"/);
  assert.match(route, /isolationLevel: "Serializable"/);
  assert.match(route, /updatedAt: input.requestUpdatedAt/);
  assert.doesNotMatch(route + sql, /DeleteObjectCommand|deletePrivate|deletePublic|\.delete\(|\.deleteMany\(|DELETE FROM|DROP TABLE/i);
});

test("restoring material cancels active requests in one transaction", () => {
  const route = read("src/app/api/admin/trash/[kind]/[id]/route.js");
  assert.match(route, /input.action === "restore"/);
  assert.match(route, /contentPurgeRequest.updateMany/);
  assert.match(route, /status: "CANCELLED"/);
  assert.match(route, /contentPurgeRequestEvent.create/);
  assert.doesNotMatch(route, /deletePublic|deletePrivate|DeleteObjectCommand/);
});
