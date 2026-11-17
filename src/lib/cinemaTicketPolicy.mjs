// Stage 5.14.5.1: film-level Pushkin indicator and date-targeted external pages.
// Only the cinema's own /schedule/<movieId> pages can become ticket destinations.
const MOVIE_PATH = /^\/schedule\/[a-z0-9]{20,40}$/i;
const PUSHKIN_ID = /^\d{4,15}$/;
const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", day: "2-digit", month: "2-digit", year: "numeric",
});

export function cinemaFilmPushkinCard(movie) {
    // The movie-level identifier comes from the Premier Zal feed.
    // This denotes film participation, not guaranteed availability for every showing.
    return typeof movie?.pushkinId === "string" && PUSHKIN_ID.test(movie.pushkinId);
}

export function normalizeCinemaMoviePageUrl(value) {
    if (value == null || value === "") return "";
    if (typeof value !== "string" || value.length > 2048 || !value.trim())
        throw new Error("Некорректная ссылка на страницу фильма.");
    let url;
    try { url = new URL(value.trim()); }
    catch { throw new Error("Некорректная ссылка на страницу фильма."); }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "kinokruf.ru" ||
        url.username || url.password || url.port || url.hash || url.search ||
        !MOVIE_PATH.test(url.pathname)) {
        throw new Error("Укажите HTTPS-адрес страницы фильма вида https://kinokruf.ru/schedule/<ID> без параметров.");
    }
    return `https://kinokruf.ru${url.pathname}`;
}

export function cinemaTicketDateLink(movie, session) {
    if (!(session?.startAt instanceof Date) || !Number.isFinite(session.startAt.getTime())) return "";
    let base;
    try { base = normalizeCinemaMoviePageUrl(movie?.ticketPageUrl); }
    catch { return ""; }
    if (!base) return "";
    const url = new URL(base);
    // Premier Zal website selects the DAY, not an individual showtime or seat.
    url.searchParams.set("date", formatter.format(session.startAt));
    url.searchParams.set("format", "");
    return url.href;
}
