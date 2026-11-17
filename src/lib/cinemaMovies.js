import { getPrisma } from "@/lib/prisma";
import { cinemaMoviesToPublic } from "@/lib/cinemaCatalog.mjs";

// CinemaWebApi is polled only by the separate operator-run importer.
// The public website reads validated, persisted PostgreSQL data.
export async function getCinemaMovies() {
    const now = new Date();
    const activeSession = {
        isCurrent: true,
        deleted: false,
        locked: false,
        startAt: { gte: now },
    };
    const rows = await getPrisma().cinemaMovie.findMany({
        where: {
            isCurrent: true,
            sessions: { some: activeSession },
        },
        include: {
            sessions: {
                where: activeSession,
                orderBy: [{ startAt: "asc" }, { externalId: "asc" }],
            },
        },
    });
    return cinemaMoviesToPublic(rows, now);
}
