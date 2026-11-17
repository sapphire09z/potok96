// Stage 5.14.3: operator-run only, no booking/payment API and no public upload endpoint.
// Import data into PostgreSQL first; this module only downloads and publishes posters.
import { createHash } from "node:crypto";
import { CINEMA_API_BASE, validateCinemaServiceId } from "./cinemaImport.mjs";
import { chooseCinemaPoster, cinemaPosterObjectKey } from "./cinemaPosterPolicy.mjs";

const MAX_POSTER_BYTES = 8 * 1024 * 1024;
const MAX_MOVIES_PER_RUN = 200;

export async function fetchCinemaPoster(serviceId, mediaId, fetchFn = fetch) {
    validateCinemaServiceId(serviceId);
    if (!Number.isSafeInteger(mediaId) || mediaId <= 0) throw new Error("Invalid poster media ID.");
    // Fixed upstream origin and validated path/query, never use user-supplied URLs.
    const url = `${CINEMA_API_BASE}/api/${serviceId}/mediaData?id=${mediaId}`;
    let response;
    try {
        response = await fetchFn(url, { method: "GET", redirect: "error",
            headers: { Accept: "image/jpeg, image/png" }, signal: AbortSignal.timeout(25_000), cache: "no-store" });
    } catch {
        throw new Error(`CinemaWebApi poster ${mediaId} could not be downloaded.`);
    }
    if (!response.ok) throw new Error(`CinemaWebApi poster ${mediaId} returned HTTP ${response.status}.`);
    const declared = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(declared) && declared > MAX_POSTER_BYTES) throw new Error("Poster exceeds 8 MiB.");
    const reader = response.body?.getReader?.();
    if (!reader) throw new Error("Poster response has no readable body.");
    const chunks = [];
    let count = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            count += value.byteLength;
            if (count > MAX_POSTER_BYTES) {
                await reader.cancel().catch(() => {});
                throw new Error("Poster exceeds 8 MiB.");
            }
            chunks.push(Buffer.from(value));
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!jpeg && !png) throw new Error("Poster must be a binary JPEG or PNG.");
    return bytes;
}

export async function synchronizeCinemaPosters({ prisma, serviceId, apply = false,
    fetchFn = fetch, transform, upload, logger = console }) {
    validateCinemaServiceId(serviceId);
    if (!prisma?.cinemaMovie?.findMany || typeof transform !== "function" || (apply && typeof upload !== "function")) {
        throw new Error("Cinema poster synchronization is not configured.");
    }
    const movies = await prisma.cinemaMovie.findMany({
        where: { isCurrent: true },
        select: { externalId: true, title: true, media: true, posterMediaId: true,
            posterKey: true, posterHash: true, updatedAt: true },
        orderBy: { externalId: "asc" },
    });
    if (movies.length > MAX_MOVIES_PER_RUN) throw new Error("Unusually large current cinema catalogue.");
    const summary = { movies: movies.length, candidates: 0, changed: 0, unchanged: 0, missing: 0, failures: 0 };
    for (const movie of movies) {
        const candidate = chooseCinemaPoster(movie.media);
        if (!candidate) {
            summary.missing++;
            if (apply && (movie.posterKey || movie.posterMediaId || movie.posterHash)) {
                const result = await prisma.cinemaMovie.updateMany({
                    where: { externalId: movie.externalId, isCurrent: true, updatedAt: movie.updatedAt },
                    data: { posterKey: null, posterMediaId: null, posterHash: null },
                });
                if (result.count !== 1) summary.failures++;
            }
            continue;
        }
        summary.candidates++;
        try {
            const bytes = await fetchCinemaPoster(serviceId, candidate.id, fetchFn);
            const hash = createHash("sha256").update(bytes).digest("hex");
            const key = cinemaPosterObjectKey(movie.externalId, candidate.id, hash);
            // Validate/decode/re-encode JPEG/PNG even on dry-run, but never upload.
            const webp = await transform(bytes);
            if (!Buffer.isBuffer(webp) || !webp.length || webp.length > MAX_POSTER_BYTES) {
                throw new Error("Invalid or oversized converted WebP image.");
            }
            if (movie.posterKey === key && movie.posterMediaId === candidate.id && movie.posterHash === hash) {
                summary.unchanged++;
                continue;
            }
            if (apply) {
                // Immutable S3 key is published BEFORE the database pointer moves.
                // If S3 or database changes fail, the previous public poster is preserved.
                await upload(key, webp, "image/webp");
                const updated = await prisma.cinemaMovie.updateMany({
                    where: { externalId: movie.externalId, isCurrent: true, updatedAt: movie.updatedAt },
                    data: { posterMediaId: candidate.id, posterKey: key, posterHash: hash },
                });
                if (updated.count !== 1) throw new Error("Movie changed during poster publication. Retry synchronization.");
            }
            summary.changed++;
        } catch (error) {
            summary.failures++;
            // Do not log credentials or complete API URLs.
            logger.error(`Poster sync failed for movie ${movie.externalId}, media ${candidate.id}: ${error.message}`);
        }
    }
    return summary;
}
