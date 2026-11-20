import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseResourceDeleteInput, deletionPrefixes, scopedKeys,
} from "../src/lib/resourcePermanentDelete.mjs";

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const id = "cmwc77gf000000lo778zpo570";
const version = "2026-11-20T05:24:05.000Z";

test("delete is an explicit action with an exact version", () => {
  assert.equal(parseResourceDeleteInput({ action: "delete", expectedUpdatedAt: version }).version.toISOString(), version);
  assert.equal(parseResourceDeleteInput({ action: "purge", expectedUpdatedAt: version }), null);
  assert.equal(parseResourceDeleteInput({ action: "delete", expectedUpdatedAt: version, all: true }), null);
  assert.equal(parseResourceDeleteInput({ action: "delete", expectedUpdatedAt: "tomorrow" }), null);
});

test("organizations are scoped to their own private/public S3 prefix", () => {
  assert.deepEqual(deletionPrefixes("orgs", id), {
    private: `media/orgs/${id}/`, public: `media/orgs/${id}/`,
  });
});

test("ads public variants are in listings, not ads", () => {
  assert.deepEqual(deletionPrefixes("ads", id), {
    private: `media/ads/${id}/`, public: `media/listings/${id}/`,
  });
  assert.throws(() => deletionPrefixes("ads", "../public"));
  assert.throws(() => deletionPrefixes("orgs", "all"));
});

test("S3 keys require a complete, exclusive, duplicate-free inventory", () => {
  const prefix = `media/orgs/${id}/`;
  const good = { truncated: false, objects: [{ key: `${prefix}abc/320.webp`, bytes: 500 }] };
  assert.deepEqual(scopedKeys(prefix, good), [`${prefix}abc/320.webp`]);
  assert.throws(() => scopedKeys(prefix, { ...good, truncated: true }));
  assert.throws(() => scopedKeys(prefix, { truncated: false,
    objects: [{ key: `media/orgs/${id}BAD/abc.webp`, bytes: 3 }] }));
  assert.throws(() => scopedKeys(prefix, { truncated: false,
    objects: [...good.objects, ...good.objects] }));
  assert.throws(() => scopedKeys(prefix, { truncated: false,
    objects: [{ key: prefix, bytes: 1 }] }));
});

test("deletion is manual, role-limited, version checked, and S3-first", () => {
  const org = text("src/app/api/admin/orgs/[id]/delete/route.js");
  const ad = text("src/app/api/account/ads/[id]/delete/route.js");
  const execution = text("src/lib/executeResourcePermanentDelete.js");
  const media = text("src/lib/deleteResourceMedia.js");
  assert.match(org, /actor\.role !== "ADMIN"/);
  assert.match(ad, /account\.role !== actor\.role/);
  assert.match(execution, /current\.ownerId !== actor\.id/);
  assert.match(execution, /updatedAt\.getTime\(\) !== version\.getTime\(\)/);
  assert.match(execution, /status: DELETING/);
  assert.ok(execution.indexOf("await removeResourceMedia") < execution.indexOf("await db.$transaction"));
  assert.match(media, /DeleteObjectCommand/);
  assert.match(media, /if \(remaining\.length\)/);
  assert.doesNotMatch(media, /DeleteObjectsCommand|DeleteBucketCommand/);
});

test("organization dependent review records are removed in a transaction", () => {
  const execution = text("src/lib/executeResourcePermanentDelete.js");
  const review = execution.indexOf("tx.orgProposalReviewEvent.deleteMany");
  const proposals = execution.indexOf("tx.orgEditProposal.deleteMany");
  const claims = execution.indexOf("tx.orgClaim.deleteMany");
  const org = execution.indexOf("tx[model].deleteMany");
  assert.ok(review > 0 && review < proposals && proposals < claims && claims < org);
  assert.match(execution, /tx\.contentTrashAudit\.create/);
});

test("migration adds only statuses and audit kind; no destructive SQL", () => {
  const sql = text("prisma/migrations/20261120100000_org_ad_permanent_delete/migration.sql");
  assert.match(sql, /ALTER TYPE "AdStatus" ADD VALUE/);
  assert.match(sql, /ALTER TYPE "OrgStatus" ADD VALUE/);
  assert.doesNotMatch(sql, /DELETE\s+FROM|DROP\s+TABLE|TRUNCATE/i);
});
