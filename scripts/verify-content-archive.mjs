// Offline checksum verification. NO write-back to database or S3.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256, verifyArchiveIndex } from "../src/lib/contentArchivePolicy.mjs";

async function hashFile(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Небезопасный файл архива.");
  const h = createHash("sha256"); let bytes = 0;
  for await (const chunk of createReadStream(file)) { h.update(chunk); bytes += chunk.length; }
  return { bytes, sha256: h.digest("hex") };
}
async function main() {
  const [option, folder] = process.argv.slice(2);
  if (option !== "--dir" || !/^[a-z0-9][a-z0-9-]{2,90}$/.test(folder || "") || process.argv.length !== 4)
    throw new Error("Usage: node scripts/verify-content-archive.mjs --dir backup-...");
  const dir = resolve("/archive", folder);
  const source = join(dir, "archive-manifest.json");
  const raw = await readFile(source, "utf8");
  const sidecar = await readFile(join(dir, "archive-manifest.sha256"), "utf8");
  if (sidecar !== `${sha256(raw)}  archive-manifest.json\n`) throw new Error("SHA-256 манифеста не совпадает.");
  const index = JSON.parse(raw);
  verifyArchiveIndex(index);
  const files = [index.database, ...index.files];
  for (const entry of files) {
    const digest = await hashFile(join(dir, entry.path));
    if (digest.bytes !== entry.bytes || digest.sha256 !== entry.sha256)
      throw new Error(`Повреждён объект архива: ${entry.path}`);
  }
  // Reject extraneous files under expected objects directory (not a shell glob).
  for (const bucket of ["private", "public"]) {
    const actual = await readdir(join(dir, "objects", bucket)).catch(e => e.code === "ENOENT" ? [] : Promise.reject(e));
    const wanted = index.files.filter(x => x.bucket === bucket).map(x => x.path.split("/").at(-1));
    if (actual.length !== wanted.length || actual.some(x => !wanted.includes(x)))
      throw new Error(`Список локальных файлов ${bucket} отличается от манифеста.`);
  }
  console.log(`Archive checksum verification OK. ${index.files.length} S3 files + PostgreSQL dump. Not a substitute for isolated restore.`);
}
main().catch(e => { console.error("Archive verification failed:", e.message); process.exitCode = 1; });
