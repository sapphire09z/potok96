import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    normalizeCommentText, canReceiveNewsComments, isValidCommentParent,
    nextModerationStatus, commentAuthorLabel, COMMENT_DAILY_LIMIT,
    COMMENT_PENDING_LIMIT, COMMENT_COOLDOWN_MS,
} from "../src/lib/newsComments.mjs";

const now = new Date("2026-11-16T08:00:00.000Z");
const post = { status: "PUBLISHED", publishedAt: new Date("2026-11-16T07:59:59.000Z"), commentsEnabled: true };
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("published, due, enabled CMS article accepts comments", () => {
    assert.equal(canReceiveNewsComments(post, now), true);
});
test("scheduled article rejects comments until due", () => {
    assert.equal(canReceiveNewsComments({ ...post, publishedAt: new Date("2026-11-16T08:01:00.000Z") }, now), false);
    assert.equal(canReceiveNewsComments({ ...post, publishedAt: now }, now), true);
});
test("draft, approved, withdrawn, missing date all reject comments", () => {
    for (const status of ["DRAFT", "REVIEW", "APPROVED", "UNPUBLISHED"]) {
        assert.equal(canReceiveNewsComments({ ...post, status }, now), false);
    }
    assert.equal(canReceiveNewsComments({ ...post, publishedAt: null }, now), false);
    assert.equal(canReceiveNewsComments(null, now), false);
});
test("comments disabled hides existing threads", () => {
    assert.equal(canReceiveNewsComments({ ...post, commentsEnabled: false }, now), false);
});
test("text keeps newlines but rejects invisible controls", () => {
    assert.equal(normalizeCommentText("  Привет!\r\nМир  "), "Привет!\nМир");
    assert.equal(normalizeCommentText("Привет\u200bмир"), null);
    assert.equal(normalizeCommentText("A\tB"), null);
    assert.equal(normalizeCommentText("Hi\u0000"), null);
});
test("text length and type validation", () => {
    for (const value of [null, 42, "", " ", "x", "x".repeat(1001)]) assert.equal(normalizeCommentText(value), null);
    assert.equal(normalizeCommentText("x".repeat(1000))?.length, 1000);
});
test("reply requires an approved root in same article", () => {
    assert.equal(isValidCommentParent({ status: "APPROVED", postId: "p1", parentId: null }, "p1"), true);
    assert.equal(isValidCommentParent({ status: "APPROVED", postId: "p2", parentId: null }, "p1"), false);
    assert.equal(isValidCommentParent({ status: "APPROVED", postId: "p1", parentId: "a" }, "p1"), false);
    assert.equal(isValidCommentParent({ status: "PENDING", postId: "p1", parentId: null }, "p1"), false);
});
test("only allowed moderation transitions", () => {
    assert.equal(nextModerationStatus("PENDING", "approve"), "APPROVED");
    assert.equal(nextModerationStatus("PENDING", "reject"), "REJECTED");
    assert.equal(nextModerationStatus("APPROVED", "hide"), "HIDDEN");
    assert.equal(nextModerationStatus("HIDDEN", "approve"), "APPROVED");
    assert.equal(nextModerationStatus("REJECTED", "approve"), "APPROVED");
    assert.equal(nextModerationStatus("DELETED", "approve"), null);
    assert.equal(nextModerationStatus("APPROVED", "reject"), null);
    assert.equal(nextModerationStatus("PENDING", "hide"), null);
});
test("missing user display name does not reveal phone", () => {
    assert.equal(commentAuthorLabel(null), "Читатель");
    assert.equal(commentAuthorLabel("  Анна "), "Анна");
});
test("rate limit constants", () => {
    assert.equal(COMMENT_COOLDOWN_MS, 30000);
    assert.equal(COMMENT_DAILY_LIMIT, 20);
    assert.equal(COMMENT_PENDING_LIMIT, 5);
});
test("schema stores comment settings off by default and relations", () => {
    const schema = source("prisma/schema.prisma");
    assert.match(schema, /commentsEnabled Boolean @default\(false\)/);
    assert.match(schema, /model NewsComment \{/);
    assert.match(schema, /model NewsCommentReport \{/);
    assert.match(schema, /@@unique\(\[commentId, userId\]\)/);
    assert.match(schema, /model NewsCommentEvent \{/);
});
test("public API guards origin, auth, schedule, cooldown and replies", () => {
    const api = source("src/app/api/news/[slug]/comments/route.js");
    for (const part of ["hasTrustedOrigin(request)", "getCurrentUser()", "canReceiveNewsComments(post, now)",
        "isValidCommentParent(parent, post.id)", "COMMENT_COOLDOWN_MS", "COMMENT_PENDING_LIMIT",
        "pg_try_advisory_xact_lock", 'status: "PENDING"']) assert.ok(api.includes(part), part);
});
test("reply is limited to one level and comments never bypass moderation", () => {
    assert.match(source("src/lib/newsComments.mjs"), /parent\.parentId === null && parent\.status === "APPROVED"/);
    const api = source("src/app/api/news/[slug]/comments/route.js");
    assert.doesNotMatch(api, /status: "APPROVED",\s*\}/);
});
test("article only renders discussion when enabled for a CMS article", () => {
    const page = source("src/app/news/[slug]/page.js");
    const lib = source("src/lib/news.js");
    assert.match(page, /post\.commentPostId && post\.commentsEnabled && <NewsComments/);
    assert.match(lib, /commentPostId: post\.id, commentsEnabled: post\.commentsEnabled/);
});
test("moderation requires staff, optimistic check and audit event", () => {
    const route = source("src/app/api/editor/news-comments/[id]/route.js");
    assert.match(route, /\["ADMIN", "MODERATOR"\]/);
    assert.match(route, /updatedAt: expected, status: comment\.status/);
    assert.match(route, /tx\.newsCommentEvent\.create/);
});
test("author deletion clears body and records event", () => {
    const route = source("src/app/api/news-comments/[id]/route.js");
    assert.match(route, /authorId !== user\.id/);
    assert.match(route, /body: "", status: "DELETED"/);
    assert.match(route, /newsCommentEvent\.create/);
});
test("reports are authenticated and unique, authors cannot self-report", () => {
    const route = source("src/app/api/news-comments/[id]/report/route.js");
    assert.match(route, /hasTrustedOrigin\(request\)/);
    assert.match(route, /comment\.authorId === user\.id/);
    assert.match(route, /commentId_userId/);
});
test("settings are admin-only and use a version lock", () => {
    const route = source("src/app/api/editor/news/[id]/comments-settings/route.js");
    assert.match(route, /user\.role !== "ADMIN"/);
    assert.match(route, /updatedAt: expected/);
    assert.match(route, /commentsEnabled: input\.enabled/);
});
test("public comment view displays only approved and safe deleted placeholders", () => {
    const page = source("src/components/news-comments/NewsComments.jsx");
    assert.match(page, /status: "APPROVED"/);
    assert.match(page, /status: "DELETED", replies: \{ some: \{ status: "APPROVED" \} \}/);
    assert.match(page, /Комментарий удалён автором/);
    assert.doesNotMatch(page, /phone: true/);
});
test("migration creates three tables and adds commentsEnabled", () => {
    const sql = source("prisma/migrations/20261116090000_news_comments/migration.sql");
    assert.match(sql, /ALTER TABLE "NewsPost" ADD COLUMN "commentsEnabled" BOOLEAN NOT NULL DEFAULT false/);
    for (const table of ["NewsComment", "NewsCommentEvent", "NewsCommentReport"]) {
        assert.ok(sql.includes(`CREATE TABLE "${table}"`));
    }
});
