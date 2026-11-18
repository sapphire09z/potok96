// OFFLINE BACKUP ONLY — no database/S3 writes, no execution authorization.
import pg from "pg";
const { Client } = pg;
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lstat, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getMediaS3 } from "../src/lib/media/s3.js";
import { listContentMedia } from "../src/lib/contentCleanupS3.js";
import {
  validPlanId, sha256, equalEtags, validateArchivedPlan, compareListing,
  safeFileName, verifyArchiveIndex,
} from "../src/lib/contentArchivePolicy.mjs";

function args() {
  const a = process.argv.slice(2);
  if (a.length !== 4 || a[0] !== "--plan" || a[2] !== "--dir" || !validPlanId(a[1]) ||
      !/^[a-z0-9][a-z0-9-]{2,90}$/.test(a[3])) {
    throw new Error("Usage: node scripts/archive-content-purge.mjs --plan c... --dir backup-20261118T... ");
  }
  return { planId: a[1], folder: a[3] };
}

async function assertArchiveFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0)
    throw new Error("Архив PostgreSQL отсутствует или небезопасен.");
  return stat;
}
async function fileDigest(file) {
  const { createReadStream } = await import("node:fs");
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  return { sha256: hash.digest("hex"), bytes };
}
async function downloadOne({ bucket, name, entry, destination }) {
  const result = await getMediaS3().send(new GetObjectCommand({ Bucket: name, Key: entry.key }));
  if (!result.Body || !equalEtags(entry.etag, result.ETag) ||
      result.ContentLength !== entry.bytes) throw new Error(`S3 ${bucket}: объект изменился.`);
  const hash = createHash("sha256");
  let size = 0;
  const checksum = new Transform({ transform(chunk, enc, done) {
    size += chunk.length;
    if (size > entry.bytes) return done(new Error("Размер объекта превысил ожидаемый."));
    hash.update(chunk);
    done(null, chunk);
  } });
  await pipeline(result.Body, checksum, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
  if (size !== entry.bytes) throw new Error(`S3 ${bucket}: неполное содержимое.`);
  return { sha256: hash.digest("hex"), bytes: size,
    contentType: result.ContentType ?? null,
    cacheControl: result.CacheControl ?? null,
    contentEncoding: result.ContentEncoding ?? null,
    contentDisposition: result.ContentDisposition ?? null,
    userMetadata: result.Metadata ?? {},
  };
}

async function main() {
  const { planId, folder } = args();
  const root = "/archive";
  const target = resolve(root, folder);
  if (!target.startsWith(`${root}/`) || target.split("/").length !== 3)
    throw new Error("Разрешён только каталог первого уровня в /archive.");
  const targetStat = await lstat(target);
  if (!targetStat.isDirectory() || targetStat.isSymbolicLink())
    throw new Error("Недопустимый каталог архива.");
  const dbFile = join(target, "database.dump");
  await assertArchiveFile(dbFile);
  // Manifest written last; a failed run is not a valid archive.
  try { await lstat(join(target, "archive-manifest.json")); throw new Error("Архив уже существует."); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let plan, request, item;
  try {
    const { rows } = await client.query('SELECT * FROM "ContentPurgePlan" WHERE id = $1', [planId]);
    plan = rows[0];
    if (!plan) throw new Error("План не найден.");
    const { rows: requests } = await client.query('SELECT * FROM "ContentPurgeRequest" WHERE id = $1', [plan.requestId]);
    request = requests[0];
    const table = plan.kind === "news" ? '"NewsPost"' : plan.kind === "events" ? '"EventPost"' : null;
    if (!table) throw new Error("Неизвестный тип материала.");
    const { rows: materials } = await client.query(`SELECT id, status, "updatedAt", "trashedAt" FROM ${table} WHERE id = $1`, [plan.itemId]);
    item = materials[0];
  } finally { await client.end(); }
  const { manifest, prefix } = validateArchivedPlan({ plan, request, material: item });
  const { privateListing, publicListing } = await listContentMedia(plan.kind, plan.itemId);
  if (privateListing.truncated || publicListing.truncated)
    throw new Error("S3: список объектов неполный.");
  compareListing(manifest.private, privateListing.objects, "private");
  compareListing(manifest.public, publicListing.objects, "public");
  const db = await fileDigest(dbFile);
  const index = {
    format: "potok96-content-backup-v1", createdAt: new Date().toISOString(),
    planId, planDigest: plan.digest, requestId: request.id,
    kind: plan.kind, itemId: plan.itemId, prefix,
    materialUpdatedAt: manifest.materialUpdatedAt, trashedAt: manifest.trashedAt,
    database: { path: "database.dump", ...db }, files: [],
    // Recovery still needs independent off-site archive and isolated restore proof.
    deletionAllowed: false,
  };
  for (const [bucket, entries, env] of [
    ["private", manifest.private, "S3_PRIVATE_BUCKET"],
    ["public", manifest.public, "S3_PUBLIC_BUCKET"],
  ]) {
    const name = process.env[env];
    if (!name) throw new Error(`Не задан ${env}`);
    const destDir = join(target, "objects", bucket);
    await mkdir(destDir, { recursive: true, mode: 0o700 });
    for (let i = 0; i < entries.length; i++) {
      const f = entries[i];
      const dest = safeFileName(bucket, i);
      const content = await downloadOne({ bucket, name, entry: f, destination: join(target, dest) });
      index.files.push({ bucket, key: f.key, etag: f.etag, path: dest, ...content });
    }
  }
  verifyArchiveIndex(index);
  const serialized = `${JSON.stringify(index, null, 2)}\n`;
  const manifestFile = join(target, "archive-manifest.json");
  await writeFile(`${manifestFile}.partial`, serialized, { mode: 0o600, flag: "wx" });
  await rename(`${manifestFile}.partial`, manifestFile);
  await writeFile(join(target, "archive-manifest.sha256"), `${sha256(serialized)}  archive-manifest.json\n`,
    { mode: 0o600, flag: "wx" });
  console.log(`Backup written: ${folder}; plan=${planId}; files=${index.files.length}; S3 bytes=${index.files.reduce((n,x)=>n+x.bytes,0)}. No data deleted.`);
}
main().catch(e => { console.error("Archive failed (not complete):", e.message); process.exitCode = 1; });
