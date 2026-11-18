import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPurgeDryRun, parsePurgePlanInput } from "../src/lib/contentPurgePlan.mjs";

const fetchSource = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const id = "cabcdefghijklmnop";
const requestId = "cqrstuvwxyzabcdef";
const updatedAt = new Date("2026-11-18T02:00:00.000Z");
const now = new Date("2026-11-18T03:00:00.000Z");
const request = { id: requestId, kind: "news", itemId: id, status: "PENDING",
  trashedAt: new Date("2026-11-17T12:00:00.000Z"), updatedAt };
const item = { status: "TRASHED", trashedAt: request.trashedAt, updatedAt,
  images: [], cover: null, _count: { comments: 0, workflowEvents: 0 } };
const inventory = { listingComplete: true, hasUnexpected: false, invalidImages: [] };
const input = { kind: "news", id, request, item, inventory, privateObjects: [], publicObjects: [], now };

test("requires exact version and narrowly scoped dry-run action", () => {
  const ok = parsePurgePlanInput({ action: "dry-run", requestId, expectedRequestUpdatedAt: updatedAt.toISOString() });
  assert.equal(ok.requestId, requestId);
  assert.equal(parsePurgePlanInput({ action: "delete", requestId, expectedRequestUpdatedAt: updatedAt.toISOString() }), null);
  assert.equal(parsePurgePlanInput({ action: "dry-run", requestId, expectedRequestUpdatedAt: updatedAt.toISOString(), execute: true }), null);
  assert.equal(parsePurgePlanInput({ action: "dry-run", requestId, expectedRequestUpdatedAt: "2026-11-18" }), null);
});

test("recent trash item is WAITING and never deletion-ready", () => {
  const x = buildPurgeDryRun(input);
  assert.equal(x.status, "WAITING");
  assert.equal(x.report.deletionAllowed, false);
  assert.match(x.report.issues.join("\n"), /30 дней/);
  assert.match(x.digest, /^[0-9a-f]{64}$/);
});

test("even mature clean material is BLOCKED pending independent approvals", () => {
  const old = new Date("2026-09-01T00:00:00.000Z");
  const x = buildPurgeDryRun({ ...input, request: { ...request, trashedAt: old },
    item: { ...item, trashedAt: old } });
  assert.equal(x.status, "BLOCKED");
  assert.equal(x.report.deletionAllowed, false);
  assert.match(x.report.issues.join("\n"), /Резервная копия/);
  assert.match(x.report.issues.join("\n"), /Внешние ссылки/);
});

test("stale placement cannot get a usable plan", () => {
  const x = buildPurgeDryRun({ ...input, item: { ...item, trashedAt: new Date("2026-11-18T02:05:00.000Z") } });
  assert.equal(x.status, "STALE");
  assert.equal(x.report.deletionAllowed, false);
});

test("manifest order does not affect digest", () => {
  const prefix = `media/news/${id}/`;
  const a = { key: prefix + "aa.webp", bytes: 6, etag: '"abcdef0123456789"' };
  const b = { key: prefix + "bb.webp", bytes: 8, etag: '"abcdef0123456788"' };
  const first = buildPurgeDryRun({ ...input, privateObjects: [b, a] });
  const second = buildPurgeDryRun({ ...input, privateObjects: [a, b] });
  assert.equal(first.digest, second.digest);
  assert.equal(first.report.privateBytes, 14);
});

test("object size or ETag change alters the digest", () => {
  const key = `media/news/${id}/photo.webp`;
  const base = { key, bytes: 6, etag: '"abcdef0123456789"' };
  const a = buildPurgeDryRun({ ...input, privateObjects: [base] });
  const b = buildPurgeDryRun({ ...input, privateObjects: [{ ...base, bytes: 7 }] });
  const c = buildPurgeDryRun({ ...input, privateObjects: [{ ...base, etag: '"abcdef0123456788"' }] });
  assert.notEqual(a.digest, b.digest);
  assert.notEqual(a.digest, c.digest);
});

test("missing S3 inventory fails closed and does not authorize deletion", () => {
  const x = buildPurgeDryRun({ ...input, inventory: null, privateObjects: undefined });
  assert.equal(x.report.s3Complete, false);
  assert.equal(x.report.deletionAllowed, false);
  assert.match(x.report.issues.join("\n"), /Список S3/);
  assert.notEqual(x.digest, buildPurgeDryRun(input).digest);
});

test("news cascading relations are flagged", () => {
  const x = buildPurgeDryRun({ ...input, item: { ...item, _count: { comments: 2, workflowEvents: 1 } },
    commentEventCount: 1, commentReportCount: 3 });
  assert.equal(x.report.commentCount, 2);
  assert.equal(x.report.commentReportCount, 3);
  assert.match(x.report.issues.join("\n"), /каскадное удаление/);
});

test("duplicate and wrong-prefix S3 entries fail inspection", () => {
  const key = `media/news/${id}/a.webp`;
  const x = buildPurgeDryRun({ ...input, privateObjects: [
    { key, bytes: 3, etag: '"abcdef0123456789"' },
    { key, bytes: 3, etag: '"abcdef0123456789"' },
    { key: "media/news/other/a.webp", bytes: 3, etag: '"abcdef0123456789"' },
  ] });
  assert.match(x.report.issues.join("\n"), /повторяющиеся/);
  assert.equal(x.report.deletionAllowed, false);
});

test("SQL and API contain no deletion executor, and only historical status values", () => {
  const sql = fetchSource("prisma/migrations/20261118213000_content_purge_plan/migration.sql");
  const api = fetchSource("src/app/api/admin/trash/plan/[kind]/[id]/route.js");
  assert.doesNotMatch(sql, /\bDELETE FROM\b|\bDROP TABLE\b|\bTRUNCATE\b/i);
  assert.match(sql, /'WAITING', 'BLOCKED', 'STALE'/);
  assert.match(api, /hasTrustedOrigin\(request\)/);
  assert.match(api, /actor\.role !== "ADMIN"/);
  assert.match(api, /contentPurgePlan\.create/);
  assert.doesNotMatch(api, /deletePublic|deletePrivate|DeleteObjectCommand|\bdeleteMany\b|\b\.delete\(/);
});
