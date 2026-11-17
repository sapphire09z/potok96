#!/usr/bin/env node
// Stage 5.14.1. Operator-run import, dry-run by default; never books or pays for tickets.
import { fetchCinemaFeed, applyCinemaFeed } from "../src/lib/cinemaImport.mjs";

async function main() {
    const args = process.argv.slice(2);
    if (args.some(a => !["--dry-run", "--apply"].includes(a)) || (args.includes("--apply") && args.includes("--dry-run"))) {
        throw new Error("Usage: node scripts/sync-cinema.mjs [--dry-run | --apply]");
    }
    const apply = args.includes("--apply");
    const serviceId = process.env.CINEMA_SERVICE_ID;
    const feed = await fetchCinemaFeed(serviceId);
    console.log(`CinemaWebApi validated: movies=${feed.movies.length}; sessions=${feed.sessions.length}; priced=${feed.sessions.filter(s => s.prices.length).length}; removed/locked=${feed.sessions.filter(s => s.deleted || s.locked).length}`);
    if (!apply) {
        console.log("DRY RUN: database unchanged. Use --apply after backup and migration.");
        return;
    }
    // Imported dynamically, so dry-run never connects to PostgreSQL.
    const { getPrisma } = await import("../src/lib/prisma.js");
    const prisma = getPrisma();
    try {
        const result = await applyCinemaFeed(prisma, feed);
        console.log(`COMMITTED: ${result.movies} movies and ${result.sessions} sessions. Public /events/cinema is unchanged.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error("Cinema import failed:", error.message);
    process.exitCode = 1;
});
