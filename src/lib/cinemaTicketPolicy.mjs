// Stage 5.14.5: verified manual links and Pushkin status are scoped to one session.
// No booking/order requests or user-provided redirect URLs are ever proxied.
import { createHash } from "node:crypto";

const URL_HOSTS = new Set([
    "kinokruf.ru", "www.kinokruf.ru", "premierzal.ru", "www.premierzal.ru",
]);

export function cinemaSessionFingerprint(session) {
    if (!session || !Number.isSafeInteger(session.externalId) || session.externalId <= 0 ||
        !Number.isSafeInteger(session.movieExternalId) || session.movieExternalId <= 0 ||
        !(session.startAt instanceof Date) || !Number.isFinite(session.startAt.getTime())) return "";
    const identity = JSON.stringify([
        session.externalId,
        session.movieExternalId,
        session.startAt.toISOString(),
        Number.isSafeInteger(session.hallExternalId) ? session.hallExternalId : null,
        typeof session.hallName === "string" ? session.hallName : "",
    ]);
    return createHash("sha256").update(identity).digest("hex");
}

export function normalizeCinemaTicketUrl(value) {
    if (value === "" || value === null || value === undefined) return "";
    if (typeof value !== "string" || value.length > 2048 || !value.trim()) {
        throw new Error("Некорректный адрес покупки билетов.");
    }
    let url;
    try { url = new URL(value.trim()); }
    catch { throw new Error("Некорректный адрес покупки билетов."); }
    if (url.protocol !== "https:" || !URL_HOSTS.has(url.hostname.toLowerCase()) ||
        url.username || url.password || url.port || url.hash ||
        ["/", "/schedule", "/schedule/"].includes(url.pathname) ||
        url.pathname.length < 2) {
        throw new Error("Укажите HTTPS-ссылку на конкретный сеанс официального билетного сайта, а не на его главную страницу.");
    }
    return url.href;
}

export function publicCinemaTicketUrl(session) {
    const fingerprint = cinemaSessionFingerprint(session);
    if (!fingerprint || session?.ticketVerifiedFingerprint !== fingerprint) return "";
    try { return normalizeCinemaTicketUrl(session.ticketUrl); }
    catch { return ""; }
}

export function cinemaPushkinVerified(session) {
    const fingerprint = cinemaSessionFingerprint(session);
    const pushkinId = session?.pushkinId;
    return Boolean(fingerprint && /^\d{4,15}$/.test(pushkinId ?? "") &&
        session.verifiedPushkinId === pushkinId &&
        session.pushkinVerifiedFingerprint === fingerprint);
}
