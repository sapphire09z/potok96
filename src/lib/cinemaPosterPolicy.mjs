// Stage 5.14.3: Only verified image-type media may become public cinema posters.
// The URLs are immutable and restricted to our own CDN namespace.
const ID = /^[1-9][0-9]*$/;
const HASH = /^[0-9a-f]{64}$/;

export function chooseCinemaPoster(media) {
    if (!Array.isArray(media)) return null;
    const candidates = media.filter(item =>
        item && Number.isSafeInteger(item.id) && item.id > 0 &&
        item.typeId === 1 && typeof item.fileName === "string" &&
        /\.(jpe?g|png)$/i.test(item.fileName)
    );
    // The provider has one poster per movie today. If it adds a replacement,
    // prefer the latest numbered media record, without ever choosing TypeId=10 videos.
    return candidates.sort((a, b) => b.id - a.id)[0] ?? null;
}

export function cinemaPosterObjectKey(movieId, mediaId, sha256) {
    if (!Number.isSafeInteger(movieId) || movieId <= 0 ||
        !Number.isSafeInteger(mediaId) || mediaId <= 0 ||
        typeof sha256 !== "string" || !HASH.test(sha256)) {
        throw new Error("Invalid cinema poster object identifier or SHA-256.");
    }
    return `media/cinema/${movieId}/${mediaId}-${sha256.slice(0, 32)}.webp`;
}

export function cinemaPosterPublicUrl(movie, base = process.env.MEDIA_PUBLIC_BASE_URL) {
    if (!movie || typeof movie.posterKey !== "string" || !movie.posterKey) return "";
    const candidate = chooseCinemaPoster(movie.media);
    if (!candidate || movie.posterMediaId !== candidate.id || !ID.test(String(movie.externalId))) return "";
    const prefix = `media/cinema/${movie.externalId}/${candidate.id}-`;
    if (!movie.posterKey.startsWith(prefix) ||
        !new RegExp(`^media/cinema/${movie.externalId}/${candidate.id}-[0-9a-f]{32}\\.webp$`).test(movie.posterKey)) {
        return "";
    }
    if (typeof base !== "string" || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(base)) return "";
    return `${base.replace(/\/$/, "")}/${movie.posterKey}`;
}
