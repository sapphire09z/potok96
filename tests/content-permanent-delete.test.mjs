import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePermanentDeleteInput, assertOwnedInventory } from "../src/lib/contentPermanentDelete.mjs";

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const id = "cmwm18htr000q0lpfbpekovo5";
const at = "2026-11-19T09:00:00.000Z";
const prefix = `media/news/${id}/`;
const inventory = objects => ({ objects, truncated: false });
const media = name => ({ key: `${prefix}${name}`, bytes: 5 });

test("the delete input is strictly one explicit action and a current version", () => {
  assert.equal(parsePermanentDeleteInput({ action: "delete", expectedUpdatedAt: at }).version.toISOString(), at);
  for (const x of [
    { action: "restore", expectedUpdatedAt: at },
    { action: "delete", expectedUpdatedAt: "2026-11-19" },
    { action: "delete", expectedUpdatedAt: at, extra: true },
    { action: "delete" },
  ]) assert.equal(parsePermanentDeleteInput(x), null);
});

test("S3 listing must be complete, duplicate-free, and within exact post prefix", () => {
  const valid = assertOwnedInventory("news", id,
    inventory([media("photo/original.jpg"), media("photo/320.webp")]),
    inventory([media("photo/320.webp")]));
  assert.equal(valid.private.length, 2);
  assert.equal(valid.public.length, 1);
  assert.throws(() => assertOwnedInventory("news", id,
    inventory([{ key: `media/news/${id}fake/secret`, bytes: 5 }]), inventory([])));
  assert.throws(() => assertOwnedInventory("news", id,
    { objects: [], truncated: true }, inventory([])));
  assert.throws(() => assertOwnedInventory("news", id,
    inventory([media("a"), media("a")]), inventory([])));
  assert.throws(() => assertOwnedInventory("events", id,
    inventory([media("a")]), inventory([])));
});

test("route has ADMIN check, S3-first cleanup, retry marker and audit", () => {
  const route = read("src/app/api/admin/trash/delete/[kind]/[id]/route.js");
  const restore = read("src/app/api/admin/trash/[kind]/[id]/route.js");
  const ui = read("src/app/admin/trash/TrashPanel.jsx");
  assert.match(route, /hasTrustedOrigin\(request\)/);
  assert.match(route, /actor\.role !== "ADMIN"/);
  assert.match(route, /account\?\.role !== "ADMIN"/);
  assert.match(route, /purgeStartedAt:/);
  assert.match(route, /deletePrivate\(key\)/);
  assert.match(route, /deletePublic\(key\)/);
  assert.ok(route.indexOf("await deletePrivate(key)") < route.indexOf("tx[model].deleteMany"));
  assert.match(route, /remaining\.private\.length \|\| remaining\.public\.length/);
  assert.match(route, /contentPurgePlan\.deleteMany/);
  assert.match(route, /contentPurgeRequestEvent\.deleteMany/);
  assert.match(route, /action: "purge"/);
  assert.match(restore, /row\.purgeStartedAt && input\.action === "restore"/);
  assert.match(ui, /PermanentDeleteButton/);
  assert.match(ui, /item\.deleting/);
});

test("migration only adds retry markers and permits purge audit", () => {
  const sql = read("prisma/migrations/20261119090000_content_permanent_delete/migration.sql");
  const schema = read("prisma/schema.prisma");
  assert.match(sql, /ALTER TABLE "NewsPost" ADD COLUMN "purgeStartedAt"/);
  assert.match(sql, /ALTER TABLE "EventPost" ADD COLUMN "purgeStartedAt"/);
  assert.match(sql, /'purge'/);
  assert.doesNotMatch(sql, /DELETE FROM|DROP TABLE|DROP COLUMN/);
  assert.equal((schema.match(/purgeStartedAt DateTime\?/g) ?? []).length, 2);
});
