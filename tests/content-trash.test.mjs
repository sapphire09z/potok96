import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canMoveToTrash, canRestoreFromTrash, earliestPurgeDate,
    parseContentTrashInput } from "../src/lib/contentTrashPolicy.mjs";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const updatedAt = "2026-11-17T09:00:00.000Z";

test("only unpublished news and draft events can enter trash", () => {
    for (const status of ["DRAFT", "REVIEW", "APPROVED", "UNPUBLISHED"])
        assert.equal(canMoveToTrash("news", status), true);
    assert.equal(canMoveToTrash("events", "DRAFT"), true);
    for (const kind of ["news", "events"]) {
        assert.equal(canMoveToTrash(kind, "PUBLISHED"), false);
        assert.equal(canMoveToTrash(kind, "TRASHED"), false);
        assert.equal(canRestoreFromTrash(kind, "TRASHED"), true);
        assert.equal(canRestoreFromTrash(kind, "DRAFT"), false);
    }
    assert.equal(canMoveToTrash("cinema", "DRAFT"), false);
});
test("validates request action, version, and reason", () => {
    const good = parseContentTrashInput({ action: "trash", expectedUpdatedAt: updatedAt, reason: "Лишний тест" });
    assert.equal(good.action, "trash");
    assert.equal(good.reason, "Лишний тест");
    assert.equal(parseContentTrashInput({ action: "restore", expectedUpdatedAt: updatedAt }).action, "restore");
    for (const x of [
        { action: "trash", expectedUpdatedAt: updatedAt, reason: "нет" },
        { action: "delete", expectedUpdatedAt: updatedAt },
        { action: "trash", expectedUpdatedAt: "2026-11-17", reason: "Причина" },
        { action: "trash", expectedUpdatedAt: updatedAt, reason: "Причина", extra: "x" },
        { action: "trash", expectedUpdatedAt: updatedAt, reason: "x".repeat(501) },
    ]) assert.equal(parseContentTrashInput(x), null);
});
test("30-day deadline is informative, never a destructive timer", () => {
    assert.equal(earliestPurgeDate("2026-11-17T00:00:00.000Z")?.toISOString(), "2026-12-17T00:00:00.000Z");
    assert.equal(earliestPurgeDate("invalid"), null);
});
test("migration and Prisma preserve records, comments, and media keys", () => {
    const schema = read("prisma/schema.prisma");
    const sql = read("prisma/migrations/20261117210000_content_trash/migration.sql");
    assert.match(schema, /enum NewsStatus \{[^}]*TRASHED/s);
    assert.match(schema, /enum EventStatus \{[^}]*TRASHED/s);
    assert.match(schema, /model ContentTrashAudit \{/);
    assert.match(sql, /CREATE TABLE "ContentTrashAudit"/);
    assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|DROP COLUMN/i);
});
test("API has privileged reversible actions with no S3 or SQL deletion", () => {
    const api = read("src/app/api/admin/trash/[kind]/[id]/route.js");
    assert.match(api, /hasTrustedOrigin\(request\)/);
    assert.match(api, /actor.role !== "ADMIN"/);
    assert.match(api, /archivedAt/);
    assert.match(api, /updateMany/);
    assert.match(api, /contentTrashAudit.create/);
    assert.match(api, /updatedAt: input.version/);
    assert.doesNotMatch(api, /deleteMany\(|\.delete\(|deletePublic|deletePrivate|DeleteObjectCommand/);
});
test("news/events public predicates remain published-only", () => {
    assert.match(read("src/lib/newsPublication.mjs"), /status: "PUBLISHED"/);
    assert.match(read("src/app/api/admin/events/[id]/status/route.js"), /status: from/);
    const news = read("src/app/editor/news/page.js");
    const events = read("src/app/admin/events/page.js");
    assert.match(news, /status: \{ not: "TRASHED" \}/);
    assert.match(events, /status: \{ not: "TRASHED" \}/);
    assert.match(read("src/app/admin/trash/page.js"), /status: "TRASHED"/);
    assert.match(read("src/app/admin/trash/page.js"), /take: limit/);
});
