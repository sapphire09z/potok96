import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    CINEMA_SYNC_INTERVAL_MS, CINEMA_POSTER_FULL_INTERVAL_MS,
    cinemaAutoSyncDue, cinemaFullPosterScanDue, cinemaPosterNeedsUpdate,
} from "../src/lib/cinemaSyncPolicy.mjs";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const now = new Date("2026-11-17T10:00:00Z");
test("scheduled imports are due every 15 minutes", () => {
    assert.equal(CINEMA_SYNC_INTERVAL_MS, 900000);
    assert.equal(cinemaAutoSyncDue(null, now), true);
    assert.equal(cinemaAutoSyncDue(new Date(now - 899999), now), false);
    assert.equal(cinemaAutoSyncDue(new Date(now - 900000), now), true);
});
test("full poster verification is manual or at most once per six hours", () => {
    assert.equal(CINEMA_POSTER_FULL_INTERVAL_MS, 21600000);
    assert.equal(cinemaFullPosterScanDue(null, now), true);
    assert.equal(cinemaFullPosterScanDue(new Date(now - 300000), now, "MANUAL"), true);
    assert.equal(cinemaFullPosterScanDue(new Date(now - 300000), now), false);
    assert.equal(cinemaFullPosterScanDue(new Date(now - CINEMA_POSTER_FULL_INTERVAL_MS), now), true);
});
test("new, changed and missing poster IDs are fetched immediately", () => {
    const old = { posterMediaId: 42, posterHash: "hash", posterKey: "media/cinema/1/42-hash.webp" };
    assert.equal(cinemaPosterNeedsUpdate(old, { id: 42 }), false);
    assert.equal(cinemaPosterNeedsUpdate(old, { id: 43 }), true);
    assert.equal(cinemaPosterNeedsUpdate({ ...old, posterKey: null }, { id: 42 }), true);
    assert.equal(cinemaPosterNeedsUpdate(old, null), true);
});
test("worker holds a PostgreSQL advisory lock and does not perform HTTP actions", () => {
    const source = read("scripts/cinema-worker.mjs");
    assert.match(source, /pg_try_advisory_lock/);
    assert.match(source, /pg_advisory_unlock/);
    assert.match(source, /applyCinemaFeed/);
    assert.match(source, /synchronizeCinemaPosters/);
    assert.match(source, /cinemaSyncRun\.updateMany/);
    assert.doesNotMatch(source, /fetch\("\/api\/|listen\(|createServer\(/);
});
test("POST API only enqueues job after session authorization and same-origin check", () => {
    const source = read("src/app/api/admin/cinema/sync/route.js");
    assert.match(source, /hasTrustedOrigin\(request\)/);
    assert.match(source, /getCurrentUser\(/);
    assert.match(source, /user\.role !== "ADMIN"/);
    assert.match(source, /cinemaSyncRun\.create/);
    assert.match(source, /60_000/); // manual 60-second anti-spam limit
    assert.doesNotMatch(source, /CINEMA_SERVICE_ID|S3_SECRET|applyCinemaFeed|fetchCinemaFeed/);
});
test("queue migration constrains values and prevents duplicate pending jobs", () => {
    const sql = read("prisma/migrations/20261117180000_cinema_sync_jobs/migration.sql");
    assert.match(sql, /CREATE TABLE "CinemaSyncRun"/);
    assert.match(sql, /CREATE UNIQUE INDEX "CinemaSyncRun_one_queued_idx"/);
    assert.match(sql, /WHERE "status" = 'QUEUED'/);
});
test("docker worker gets server-side secrets, is not publicly exposed", () => {
    const compose = read("compose.yaml");
    const docker = read("Dockerfile.migrate");
    assert.match(compose, /cinema-worker:[\s\S]*?\/opt\/potok96-deploy\/cinema\.env/);
    assert.match(compose, /cinema-worker:[\s\S]*?\/opt\/potok96-deploy\/s3\.env/);
    assert.match(docker, /COPY scripts\/cinema-worker\.mjs/);
    assert.doesNotMatch(compose.match(/  cinema-worker:[\s\S]*?(?=\n  [a-z-]+:|$)/)?.[0] ?? "", /ports:/);
});
test("admin page is protected by ADMIN and has a manually controlled button", () => {
    const page = read("src/app/admin/cinema/page.js");
    const client = read("src/app/admin/cinema/CinemaSyncPanel.jsx");
    assert.match(page, /user\.role !== "ADMIN"/);
    assert.match(client, /Обновить сейчас/);
    assert.match(client, /method: "POST"/);
});
