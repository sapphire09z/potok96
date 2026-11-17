import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    normalizeAdminCommentPage, normalizeAdminCommentStatus,
    isPublicNewsCommentVisible, ADMIN_USER_COMMENTS_PER_PAGE,
    ADMIN_USER_COMMENT_STATUSES,
} from "../src/lib/adminUserComments.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const list = read("src/app/admin/users/page.js");
const history = read("src/app/admin/users/[id]/comments/page.js");
const css = read("src/app/admin/users/[id]/comments/comments.module.css");
const now = new Date("2026-11-17T10:00:00Z");
const comment = (status, postOverrides = {}) => ({ status, post: {
    status: "PUBLISHED", commentsEnabled: true, publishedAt: new Date("2026-11-16T09:00:00Z"),
    ...postOverrides,
} });

test("User cards show real grouped comment counts with link to author history", () => {
    assert.match(list, /prisma\.newsComment\.groupBy\(/);
    assert.match(list, /by: \["authorId"\]/);
    assert.match(list, /where: \{ authorId: \{ in: ids \} \}/);
    assert.match(list, /comments\.get\(user\.id\)/);
    assert.match(list, /\/admin\/users\/\$\{encodeURIComponent\(user\.id\)\}\/comments/);
});

test("History is admin only, separate from moderator access", () => {
    assert.match(history, /await getCurrentUser\(\)/);
    assert.match(history, /if \(!me\) redirect\("\/login"\)/);
    assert.match(history, /if \(me\.role !== "ADMIN"\) notFound\(\)/);
});

test("Author filtering is applied to both grouping and individual records", () => {
    assert.match(history, /groupBy\(\{\s*by: \["status"\], where: \{ authorId: user\.id \}/);
    assert.match(history, /findMany\(\{\s*where: \{ authorId: user\.id/);
});

test("All moderation statuses and archived accounts are included", () => {
    assert.deepEqual(ADMIN_USER_COMMENT_STATUSES, ["PENDING", "APPROVED", "REJECTED", "HIDDEN", "DELETED"]);
    assert.match(history, /where: \{ id \}/);
    assert.doesNotMatch(history, /archivedAt: null/);
    assert.match(history, /item\.status === "DELETED"/);
    assert.match(history, /Текст удалён из базы данных/);
});

test("Status filter rejects unknown values", () => {
    assert.equal(normalizeAdminCommentStatus("PENDING"), "PENDING");
    assert.equal(normalizeAdminCommentStatus("HIDDEN"), "HIDDEN");
    assert.equal(normalizeAdminCommentStatus("deleted"), "ALL");
    assert.equal(normalizeAdminCommentStatus(["APPROVED"]), "ALL");
    assert.equal(normalizeAdminCommentStatus("ALL"), "ALL");
});

test("Pagination clamps invalid page values", () => {
    assert.equal(ADMIN_USER_COMMENTS_PER_PAGE, 20);
    for (const value of [undefined, -2, 0, "nan", "2.5", "10001", [1, 2]]) {
        assert.equal(normalizeAdminCommentPage(value), 1);
    }
    assert.equal(normalizeAdminCommentPage("12"), 12);
    assert.match(history, /Math\.min\(requestedPage, pageCount\)/);
});

test("Public link only points to a released, enabled, approved story", () => {
    assert.equal(isPublicNewsCommentVisible(comment("APPROVED"), now), true);
    for (const status of ["PENDING", "REJECTED", "HIDDEN", "DELETED"]) {
        assert.equal(isPublicNewsCommentVisible(comment(status), now), false);
    }
    assert.equal(isPublicNewsCommentVisible(comment("APPROVED", { commentsEnabled: false }), now), false);
    assert.equal(isPublicNewsCommentVisible(comment("APPROVED", { status: "UNPUBLISHED" }), now), false);
    assert.equal(isPublicNewsCommentVisible(comment("APPROVED", { publishedAt: new Date("2026-11-20T00:00:00Z") }), now), false);
});

test("History is server rendered, read-only, no mutation endpoints added", () => {
    assert.match(history, /export const dynamic = "force-dynamic"/);
    assert.match(history, /robots: \{ index: false, follow: false \}/);
    assert.doesNotMatch(history, /fetch\(/);
    assert.doesNotMatch(history, /<form/);
    assert.ok(css.length > 500);
});
