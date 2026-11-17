#!/usr/bin/env node
// Run manually via: docker compose --profile tools run --rm cinema-posters [--dry-run | --apply]
import sharp from "sharp";
import { getPrisma } from "../src/lib/prisma.js";
import { putPublic } from "../src/lib/media/s3.js";
import { synchronizeCinemaPosters } from "../src/lib/cinemaPosters.mjs";

async function convertPoster(bytes) {
    // Re-encoding strips untrusted metadata and limits output resolution.
    const info = await sharp(bytes, { limitInputPixels: 25_000_000, failOn: "error" }).metadata();
    if (!["jpeg", "png"].includes(info.format) || !info.width || !info.height ||
        info.width * info.height > 25_000_000 || (info.pages ?? 1) > 1) {
        throw new Error("Unsupported or oversized source image.");
    }
    return sharp(bytes, { limitInputPixels: 25_000_000, failOn: "error" })
        .rotate().resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 }).toBuffer();
}

async function main() {
    const args = process.argv.slice(2);
    if (args.some(a => !["--dry-run", "--apply"].includes(a)) ||
        (args.includes("--dry-run") && args.includes("--apply"))) {
        throw new Error("Usage: node scripts/sync-cinema-posters.mjs [--dry-run | --apply]");
    }
    const apply = args.includes("--apply");
    const prisma = getPrisma();
    try {
        const stats = await synchronizeCinemaPosters({ prisma,
            serviceId: process.env.CINEMA_SERVICE_ID, apply,
            transform: convertPoster, upload: putPublic });
        console.log(`${apply ? "APPLY" : "DRY RUN"}: movies=${stats.movies}; poster candidates=${stats.candidates}; updated=${stats.changed}; unchanged=${stats.unchanged}; without poster=${stats.missing}; failures=${stats.failures}`);
        if (!apply) console.log("DRY RUN: no Selectel uploads and no PostgreSQL changes.");
        if (stats.failures) process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}
main().catch(error => { console.error("Cinema poster sync failed:", error.message); process.exitCode = 1; });
