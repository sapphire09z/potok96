import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cleanupPreview, humanSize, mediaPrefix } from "../src/lib/contentCleanupPreview.mjs";

const id = "c1234567890";
const photo = "12345678-1234-1234-1234-123456789abc";
const prefix = `media/news/${id}/`;

function plan(override = {}) {
  return cleanupPreview({ kind: "news", id,
    images: [{ id: photo, storageKey: `${prefix}${photo}` }],
    privateObjects: [{ key: `${prefix}${photo}/original.jpg`, bytes: 200 }],
    publicObjects: [{ key: `${prefix}${photo}/960.webp`, bytes: 100 }],
    ...override,
  });
}

test("limits inspection to validated CMS record prefixes", () => {
  assert.equal(mediaPrefix("events", id), `media/events/${id}/`);
  for (const [kind, post] of [["cinema", id], ["news", "../secret"], ["events", "c1"]]) {
    assert.throws(() => mediaPrefix(kind, post));
  }
});
test("counts bytes and recognizes verified image paths only", () => {
  const p = plan();
  assert.deepEqual(p.privateSummary, { count: 1, bytes: 200, recognized: 1, unlinked: 0, unexpected: 0 });
  assert.deepEqual(p.publicSummary, { count: 1, bytes: 100, recognized: 1, unlinked: 0, unexpected: 0 });
  assert.equal(p.readyForDeletion, false);
});
test("flags unexpected files, orphaned objects, and malformed linked keys", () => {
  const foreign = "abcdefab-1234-1234-1234-123456789012";
  const result = plan({
    publicObjects: [{ key: `${prefix}${foreign}/960.webp`, bytes: 50 },
      { key: `${prefix}${photo}/raw.exe`, bytes: 2 }],
  });
  const invalid = plan({ images: [{ id: photo, storageKey: "media/other/post/image" }] });
  assert.equal(invalid.invalidImages.length, 1);
  assert.equal(result.publicSummary.unlinked, 1);
  assert.equal(result.publicSummary.unexpected, 1);
  assert.equal(result.hasUnexpected, true);
});
test("marks truncated S3 listing as incomplete and never deletion-ready", () => {
  const p = plan({ privateTruncated: true });
  assert.equal(p.listingComplete, false);
  assert.equal(p.readyForDeletion, false);
});
test("rejects S3 entries outside validated prefixes or with invalid sizes", () => {
  assert.throws(() => plan({ privateObjects: [{ key: "media/news/c9999999999/a", bytes: 10 }] }));
  assert.throws(() => plan({ publicObjects: [{ key: `${prefix}${photo}/960.webp`, bytes: -1 }] }));
});
test("formats storage sizes for ADMIN", () => {
  assert.equal(humanSize(0), "0 Б");
  assert.equal(humanSize(2048), "2,00 КБ");
  assert.equal(humanSize(-1), "неизвестно");
});
test("inspector contains no destructive S3 or database operations", () => {
  for (const file of ["src/lib/contentCleanupS3.js", "src/app/admin/trash/inspect/page.js"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /DeleteObjectCommand|deleteMany\s*\(|delete\s*\(|updateMany\s*\(|\$executeRaw|\.send\(new Put/);
  }
});
