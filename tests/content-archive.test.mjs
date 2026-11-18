import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validPlanId, sha256, equalEtags, validateArchivedPlan, compareListing, safeFileName, verifyArchiveIndex, planDigestFromJsonb } from "../src/lib/contentArchivePolicy.mjs";
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const dt = new Date("2026-11-18T02:00:00.000Z");
const file = { key: "media/news/ckw5a0123456789012345/12345678-1234-1234-1234-123456789abc/960.webp", bytes: 4, etag: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' };
function fixture() {
  const manifest = { version: 1, kind: "news", id: "ckw5a0123456789012345", requestId: "ckw5a9876543210987654", trashedAt: dt.toISOString(), materialUpdatedAt: dt.toISOString(), requestUpdatedAt: dt.toISOString(), s3ScanComplete: true, s3HasUnexpected: false, invalidImageIds: [], imageBindings: [], commentCount:0, workflowCount:0, commentEventCount:0, commentReportCount:0, manualCoverPresent:false, private: [file], public: [] };
  const plan = { id: "ckw5a5555555555555555", status: "WAITING", kind: "news", itemId: manifest.id, requestId: manifest.requestId, digest: planDigestFromJsonb(manifest), report: { manifest }, trashedAt: dt, materialUpdatedAt: dt, requestUpdatedAt: dt };
  return { plan, request: { id: manifest.requestId, kind: "news", itemId: manifest.id, status: "PENDING", trashedAt: dt, updatedAt: dt }, material: { status: "TRASHED", trashedAt: dt, updatedAt: dt } };
}
test("accepts a verified exact-version pending dry-run", () => {
  const x = fixture(); assert.equal(validateArchivedPlan(x).totalBytes, 4);
});
test("digest validation survives PostgreSQL JSONB key reordering", () => {
  const x = fixture();
  const m = x.plan.report.manifest;
  x.plan.report.manifest = Object.fromEntries(Object.entries(m).reverse());
  x.plan.report.manifest.private = [Object.fromEntries(Object.entries(file).reverse())];
  assert.equal(validateArchivedPlan(x).totalBytes,4);
});
test("rejects stale, cancelled or tampered plans", () => {
  for (const mutate of [x=>x.request.status="CANCELLED", x=>x.material.updatedAt=new Date(dt.getTime()+1), x=>x.plan.digest="a".repeat(64), x=>x.plan.status="STALE", x=>x.plan.report.manifest.private[0].key="../escape", x=>x.plan.report.manifest.s3ScanComplete=false]) {
    const x=fixture(); mutate(x); assert.throws(()=>validateArchivedPlan(x));
  }
});
test("compares S3 listings including etag, sizes and missing objects", () => {
  assert.equal(compareListing([file],[{...file}],"private"),true);
  assert.throws(()=>compareListing([file],[{...file,bytes:5}],"private"));
  assert.throws(()=>compareListing([file],[],"private"));
  assert.throws(()=>compareListing([file],[{...file,etag:'"bbbbbbbbbbbbbbbb"'}],"private"));
});
test("limits archive file names to deterministic safe paths", () => {
  assert.equal(safeFileName("public",0),"objects/public/0001.bin");
  assert.throws(()=>safeFileName("../secret",0));
  assert.throws(()=>safeFileName("private",1000));
  assert.equal(validPlanId("../../etc/passwd"),false);
});
test("rejects archive index traversal, duplicate names and deletion approval", () => {
  const x = {format:"potok96-content-backup-v1",planId:fixture().plan.id, planDigest:"a".repeat(64),database:{path:"database.dump",bytes:1,sha256:"b".repeat(64)}, files:[],deletionAllowed:false};
  assert.equal(verifyArchiveIndex(x),true);
  assert.throws(()=>verifyArchiveIndex({...x,deletionAllowed:true}));
  assert.throws(()=>verifyArchiveIndex({...x,files:[{bucket:"private",path:"../escape",bytes:1,sha256:"b".repeat(64),key:file.key}]}));
});
test("backup executor has no destructive PostgreSQL/S3 instructions", () => {
  const scripts=[read("scripts/archive-content-purge.mjs"),read("scripts/verify-content-archive.mjs")].join("\n");
  assert.doesNotMatch(scripts, /DeleteObjectCommand|deletePrivate\(|deletePublic\(|\.deleteMany\(|\bDELETE\s+FROM\b/i);
  assert.match(scripts, /GetObjectCommand/);
  assert.match(scripts, /sha256/);
  const policy=read("src/lib/contentArchivePolicy.mjs"); assert.match(policy,/deletionAllowed !== false/);
});
