#!/usr/bin/env node
// Dedicated background process; the ADMIN web route only enqueues requests.
// PostgreSQL session advisory lock ensures one worker across all containers.
import pg from "pg";
const { Client } = pg;
import { getPrisma } from "../src/lib/prisma.js";
import { fetchCinemaFeed, applyCinemaFeed, validateCinemaServiceId } from "../src/lib/cinemaImport.mjs";
import { synchronizeCinemaPosters } from "../src/lib/cinemaPosters.mjs";
import { cinemaAutoSyncDue, cinemaFullPosterScanDue, cinemaPosterNeedsUpdate, CINEMA_SYNC_POLL_MS } from "../src/lib/cinemaSyncPolicy.mjs";
import { convertCinemaPoster } from "../src/lib/cinemaPosterTransform.mjs";
import { putPublic } from "../src/lib/media/s3.js";

const LOCK_NUMBER = 9614514;
let stopping = false;
process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const message = e => String(e?.message ?? "Сбой обновления").slice(0, 900);

async function perform(prisma, job, serviceId) {
    let movieCount = null, sessionCount = null;
    let summary = null, fullScan = false;
    try {
        const feed = await fetchCinemaFeed(serviceId);
        const imported = await applyCinemaFeed(prisma, feed);
        movieCount = imported.movies;
        sessionCount = imported.sessions;
        // Every 15 minutes: fetch new/missing movie posters only.
        // Every 6 hours (or manual run): also check same-ID upstream replacements.
        const latestFull = await prisma.cinemaSyncRun.findFirst({
            where: { posterFullScan: true, status: { in: ["SUCCEEDED", "PARTIAL"] } },
            select: { finishedAt: true }, orderBy: { finishedAt: "desc" },
        });
        fullScan = cinemaFullPosterScanDue(latestFull?.finishedAt, new Date(), job.trigger);
        summary = await synchronizeCinemaPosters({
            prisma, serviceId, apply: true,
            transform: convertCinemaPoster,
            upload: putPublic,
            shouldProcessMovie: (movie, candidate) => fullScan || cinemaPosterNeedsUpdate(movie, candidate),
        });
        await prisma.cinemaSyncRun.update({ where: { id: job.id }, data: {
            status: summary.failures ? "PARTIAL" : "SUCCEEDED",
            movieCount, sessionCount,
            posterCandidates: summary.candidates,
            posterUpdated: summary.changed,
            posterUnchanged: summary.unchanged,
            posterSkipped: summary.skipped,
            posterFailures: summary.failures,
            posterFullScan: fullScan && summary.failures === 0,
            finishedAt: new Date(),
            error: summary.failures ? `Не удалось обработать постеров: ${summary.failures}` : null,
        } });
        console.log(`Cinema sync ${job.id}: films=${movieCount}, sessions=${sessionCount}, posters updated=${summary.changed}, skipped=${summary.skipped}, failures=${summary.failures}`);
    } catch (error) {
        await prisma.cinemaSyncRun.update({ where: { id: job.id }, data: {
            status: "FAILED", movieCount, sessionCount,
            posterCandidates: summary?.candidates ?? null,
            posterUpdated: summary?.changed ?? null,
            posterFailures: summary?.failures ?? null,
            posterFullScan: false,
            finishedAt: new Date(), error: message(error),
        } });
        // Do not log secrets, credentials or upstream URLs.
        console.error(`Cinema sync ${job.id} failed: ${message(error)}`);
    }
}

async function tick(prisma, serviceId) {
    let next = await prisma.cinemaSyncRun.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
    if (!next) {
        const latest = await prisma.cinemaSyncRun.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
        if (cinemaAutoSyncDue(latest?.createdAt)) {
            try { next = await prisma.cinemaSyncRun.create({ data: { trigger: "AUTO" } }); }
            catch (error) { if (error?.code !== "P2002") throw error; }
        }
    }
    if (!next || stopping) return;
    const claimed = await prisma.cinemaSyncRun.updateMany({
        where: { id: next.id, status: "QUEUED" },
        data: { status: "RUNNING", startedAt: new Date() },
    });
    if (claimed.count !== 1) return;
    await perform(prisma, next, serviceId);
}

async function main() {
    const serviceId = validateCinemaServiceId(process.env.CINEMA_SERVICE_ID);
    const pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    const prisma = getPrisma();
    let locked = false;
    pg.on("error", () => { console.error("Cinema worker database lock lost"); process.exit(1); });
    try {
        const result = await pg.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_NUMBER]);
        locked = result.rows[0]?.locked === true;
        if (!locked) throw new Error("Another cinema synchronization worker holds the lock.");
        // After an ungraceful restart, formerly running jobs cannot resume.
        await prisma.cinemaSyncRun.updateMany({ where: { status: "RUNNING" }, data: {
            status: "FAILED", finishedAt: new Date(), error: "Worker restarted during synchronization. Please retry.",
        } });
        console.log("Cinema worker ready: movies/sessions every 15 min, full poster check every 6 h.");
        while (!stopping) {
            try { await tick(prisma, serviceId); }
            catch (error) { console.error("Cinema worker poll error:", message(error)); }
            if (!stopping) await sleep(CINEMA_SYNC_POLL_MS);
        }
    } finally {
        await prisma.$disconnect();
        if (locked) await pg.query("SELECT pg_advisory_unlock($1)", [LOCK_NUMBER]).catch(() => {});
        await pg.end().catch(() => {});
    }
}
main().catch(error => { console.error("Cinema worker stopped:", message(error)); process.exitCode = 1; });
