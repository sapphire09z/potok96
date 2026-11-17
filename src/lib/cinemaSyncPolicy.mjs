// Shared policy for scheduled and operator-requested cinema sync jobs.
export const CINEMA_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const CINEMA_POSTER_FULL_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const CINEMA_SYNC_POLL_MS = 10_000;

export function cinemaAutoSyncDue(lastCreatedAt, now = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Invalid sync time");
    if (!lastCreatedAt) return true;
    const at = new Date(lastCreatedAt);
    return Number.isFinite(at.getTime()) && now.getTime() - at.getTime() >= CINEMA_SYNC_INTERVAL_MS;
}

export function cinemaFullPosterScanDue(lastFullScanAt, now = new Date(), trigger = "AUTO") {
    if (trigger === "MANUAL" || !lastFullScanAt) return true;
    const at = new Date(lastFullScanAt);
    return Number.isFinite(at.getTime()) && now.getTime() - at.getTime() >= CINEMA_POSTER_FULL_INTERVAL_MS;
}

export function cinemaPosterNeedsUpdate(movie, candidate) {
    if (!candidate) return true; // clear a now-missing source poster, if any
    return movie.posterMediaId !== candidate.id || !movie.posterKey || !movie.posterHash;
}

export const CINEMA_SYNC_STATUSES = Object.freeze(["QUEUED", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"]);
