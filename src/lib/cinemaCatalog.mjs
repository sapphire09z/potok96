import { cinemaPosterPublicUrl } from "./cinemaPosterPolicy.mjs";

// Stage 5.14.2: public, read-only cinema catalogue presentation.
// No unverified ticket URLs, poster URLs, or Pushkin Card claims are published.
export function cinemaMovieToPublic(row, now = new Date()) {
    if (!row || row.isCurrent !== true || !Number.isSafeInteger(row.externalId)) return null;
    const nowMs = now.getTime();
    const valid = (Array.isArray(row.sessions) ? row.sessions : [])
        .filter(item => item?.isCurrent === true && item.deleted !== true && item.locked !== true
            && item.startAt instanceof Date && Number.isFinite(item.startAt.getTime())
            && item.startAt.getTime() >= nowMs)
        .sort((a, b) => a.startAt - b.startAt || a.externalId - b.externalId);
    if (!valid.length) return null;

    const story = typeof row.story === "string" ? row.story.trim() : "";
    const description = story.length > 650 ? `${story.slice(0, 647).trimEnd()}…` : story;
    const genres = Array.isArray(row.genres) ? row.genres.filter(x => typeof x === "string" && x.trim()) : [];
    const screenings = valid.map(item => {
        const n = item.minPriceRub == null ? null : Number(item.minPriceRub);
        return {
            id: item.externalId,
            startAt: item.startAt.toISOString(),
            price: n !== null && Number.isFinite(n) && n >= 0 ? n : null,
            hallName: typeof item.hallName === "string" ? item.hallName : "",
            formatName: typeof item.formatName === "string" ? item.formatName : "",
            // Potential external PushkinId is not sufficient evidence for the badge.
            pushkinCard: false,
            ticketUrl: "",
        };
    });
    return {
        slug: `cinema-${row.externalId}`,
        title: row.title,
        genre: genres.join(" · "),
        durationMinutes: Number.isSafeInteger(row.durationMinutes) && row.durationMinutes > 0
            ? row.durationMinutes : null,
        ageRating: typeof row.ageRating === "string" ? row.ageRating : "",
        summary: description,
        poster: cinemaPosterPublicUrl(row),
        screenings,
    };
}

export function cinemaMoviesToPublic(rows, now = new Date()) {
    return (Array.isArray(rows) ? rows : [])
        .map(row => cinemaMovieToPublic(row, now))
        .filter(Boolean)
        .sort((a, b) => Date.parse(a.screenings[0].startAt) - Date.parse(b.screenings[0].startAt)
            || a.title.localeCompare(b.title, "ru"));
}
