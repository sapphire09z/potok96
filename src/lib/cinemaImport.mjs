// Stage 5.14.1: normalize a read-only CinemaWebApi feed before touching the database.
// The provider returns local Krasnoufimsk times WITHOUT an offset (UTC+05:00).
export const CINEMA_TIME_OFFSET_MINUTES = 300;
export const CINEMA_API_BASE = "http://37.79.202.93/CinemaWebApi";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_BYTES = 4_000_000;

export function validateCinemaServiceId(value) {
    if (typeof value !== "string" || !GUID.test(value)) throw new Error("CINEMA_SERVICE_ID must be a UUID.");
    return value;
}

export function cinemaLocalToUtc(input) {
    // Reject dates already carrying an offset: the source convention is a local wall clock.
    if (typeof input !== "string") throw new Error("Session DateTime must be a string.");
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?$/.exec(input);
    if (!match) throw new Error(`Invalid CinemaWebApi local DateTime: ${input.slice(0, 40)}`);
    const [, yy, mm, dd, hh, mi, ss, ms = "0"] = match;
    const year = Number(yy), month = Number(mm), day = Number(dd);
    const hour = Number(hh), minute = Number(mi), second = Number(ss), milli = Number(ms.slice(0, 3).padEnd(3, "0"));
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59)
        throw new Error("Out-of-range session local time.");
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, milli);
    const roundTrip = new Date(localAsUtc);
    if (roundTrip.getUTCFullYear() !== year || roundTrip.getUTCMonth() !== month - 1 ||
        roundTrip.getUTCDate() !== day || roundTrip.getUTCHours() !== hour ||
        roundTrip.getUTCMinutes() !== minute || roundTrip.getUTCSeconds() !== second) {
        throw new Error("Nonexistent session local date.");
    }
    return new Date(localAsUtc - CINEMA_TIME_OFFSET_MINUTES * 60_000);
}

function intId(value, label) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid ${label} identifier.`);
    return value;
}
function optionalInt(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function optionalString(value, max = 200) {
    if (value == null || value === "") return null;
    if (typeof value !== "string") throw new Error("Unexpected non-string metadata field.");
    return value.trim().slice(0, max) || null;
}
function stringField(value, max, label) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
        throw new Error(`Invalid or too long ${label}.`);
    }
    return value.trim();
}
function names(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => (typeof item === "string" ? item : item?.Name))
        .filter(item => typeof item === "string" && item.trim())
        .map(item => item.trim().slice(0, 150)).slice(0, 100);
}
function media(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && Number.isSafeInteger(item.Id) && item.Id > 0)
        .map(item => ({
            id: item.Id,
            typeId: optionalInt(item.TypeId),
            fileName: typeof item.FileName === "string" ? item.FileName.slice(0, 256) : "",
        })).slice(0, 40);
}
function prices(value) {
    if (!Array.isArray(value)) return [];
    if (value.length > 100) throw new Error("Unexpectedly large session price list.");
    return value.map(item => {
        if (!item || typeof item !== "object") throw new Error("Invalid price object.");
        const amount = Number(item.Sum);
        if (item.Sum == null || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
            throw new Error("Invalid ticket price.");
        }
        return {
            id: optionalInt(item.Id),
            ticketId: optionalInt(item.TicketId),
            ticketName: typeof item.TicketName === "string" ? item.TicketName.slice(0, 120) : "",
            name: typeof item.Name === "string" ? item.Name.slice(0, 120) : "",
            sum: amount,
            discounts: Array.isArray(item.Discounts) ? item.Discounts.slice(0, 100) : [],
        };
    });
}

export function normalizeCinemaMovie(movie) {
    if (!movie || typeof movie !== "object" || Array.isArray(movie)) throw new Error("Invalid movie object.");
    const externalId = intId(movie.Id, "movie");
    const duration = Number(movie.Duration);
    return {
        externalId,
        title: stringField(movie.Name, 180, "movie Name"),
        story: typeof movie.Story === "string" ? movie.Story.slice(0, 100000) : "",
        durationMinutes: Number.isFinite(duration) && duration > 0 && duration <= 1000 ? Math.round(duration) : null,
        ageRating: optionalString(movie.Rate, 16) ?? "",
        genres: names(movie.Genres),
        directors: names(movie.Directors),
        countries: names(movie.Countries),
        cast: names(movie.Cast),
        media: media(movie.MediaDatas),
        pzApiId: optionalString(movie.PzApiId, 120),
        kinoplanId: optionalInt(movie.KinoplanId),
        pushkinId: optionalString(movie.PushkinId, 120),
    };
}

export function normalizeCinemaSession(session) {
    if (!session || typeof session !== "object" || Array.isArray(session)) throw new Error("Invalid session object.");
    const externalId = intId(session.Id, "session");
    const movieExternalId = intId(session.MovieId, "session movie");
    const p = prices(session.Prices);
    return {
        externalId,
        movieExternalId,
        startAt: cinemaLocalToUtc(session.DateTime),
        hallExternalId: optionalInt(session.Hall?.Id),
        hallName: typeof session.Hall?.Name === "string" ? session.Hall.Name.trim().slice(0, 120) : "",
        formatName: typeof session.Format?.Name === "string" ? session.Format.Name.trim().slice(0, 60) : "",
        formatExternalId: optionalInt(session.Format?.Id),
        prices: p,
        minPriceRub: p.length ? Math.min(...p.map(item => item.sum)).toFixed(2) : null,
        locked: session.Locked === true,
        deleted: session.Deleted === true,
        isEvent: session.IsEvent === true,
        noSeats: session.NoSeats === true,
        rentalLicense: optionalInt(session.RentalLicense),
        pushkinId: optionalString(session.PushkinId, 120),
        textCode: typeof session.TextCode === "string" ? session.TextCode.slice(0, 40) : "",
    };
}

export function normalizeCinemaFeed(rawMovies, rawSessions) {
    if (!Array.isArray(rawMovies) || !Array.isArray(rawSessions) || !rawMovies.length || !rawSessions.length) {
        throw new Error("Empty or malformed provider response. Database remains unchanged.");
    }
    if (rawMovies.length > 10000 || rawSessions.length > 100000) throw new Error("Abnormal provider feed size.");
    const movies = rawMovies.map(normalizeCinemaMovie);
    const sessions = rawSessions.map(normalizeCinemaSession);
    const movieIds = new Set(movies.map(x => x.externalId));
    const sessionIds = new Set(sessions.map(x => x.externalId));
    if (movieIds.size !== movies.length || sessionIds.size !== sessions.length) throw new Error("Duplicate provider identifiers.");
    for (const session of sessions) {
        if (!movieIds.has(session.movieExternalId)) {
            throw new Error(`Session ${session.externalId} refers to movie ${session.movieExternalId} absent from /movies; import aborted.`);
        }
    }
    return { movies, sessions };
}

async function getJson(fetchFn, serviceId, suffix) {
    const url = `${CINEMA_API_BASE}/api/${encodeURIComponent(serviceId)}/${suffix}`;
    let response;
    try {
        response = await fetchFn(url, { method: "GET", signal: AbortSignal.timeout(20_000),
            redirect: "error", headers: { Accept: "application/json" }, cache: "no-store" });
    } catch {
        throw new Error(`CinemaWebApi /${suffix.split("?")[0]} is unavailable.`);
    }
    if (!response.ok) throw new Error(`CinemaWebApi /${suffix.split("?")[0]} returned HTTP ${response.status}.`);
    const length = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error("CinemaWebApi response exceeds size limit.");
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) throw new Error("CinemaWebApi response exceeds size limit.");
    try { return JSON.parse(raw); }
    catch { throw new Error("CinemaWebApi returned invalid JSON."); }
}

export async function fetchCinemaFeed(serviceId, fetchFn = fetch) {
    validateCinemaServiceId(serviceId);
    const [movies, sessions] = await Promise.all([
        getJson(fetchFn, serviceId, "movies"),
        getJson(fetchFn, serviceId, "sessions?showPrices=true"),
    ]);
    return normalizeCinemaFeed(movies, sessions);
}

// Only the operator explicitly chooses --apply. All API traffic above is GET-only.
export async function applyCinemaFeed(prisma, { movies, sessions }, now = new Date()) {
    if (!Array.isArray(movies) || !movies.length || !Array.isArray(sessions) || !sessions.length)
        throw new Error("Refusing to write an empty feed.");
    return prisma.$transaction(async tx => {
        // The whole replacement is atomic. If one item fails, old data remains intact.
        await tx.cinemaSession.updateMany({ data: { isCurrent: false } });
        await tx.cinemaMovie.updateMany({ data: { isCurrent: false } });
        for (const movie of movies) {
            const data = { ...movie, isCurrent: true, lastSeenAt: now };
            await tx.cinemaMovie.upsert({ where: { externalId: movie.externalId },
                create: data, update: data });
        }
        for (const session of sessions) {
            const data = { ...session, isCurrent: true, lastSeenAt: now };
            await tx.cinemaSession.upsert({ where: { externalId: session.externalId },
                create: data, update: data });
        }
        return { movies: movies.length, sessions: sessions.length };
    }, { timeout: 60_000, maxWait: 15_000 });
}
