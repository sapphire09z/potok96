import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    cinemaLocalToUtc, validateCinemaServiceId, normalizeCinemaMovie,
    normalizeCinemaSession, normalizeCinemaFeed, fetchCinemaFeed, applyCinemaFeed,
} from "../src/lib/cinemaImport.mjs";

const movie = (id = 1196) => ({
    Id: id, Name: "Морозко", Duration: 105, Story: "Сказка", Rate: "6+",
    MediaDatas: [{ Id: 3315, TypeId: 1, FileName: "3315.jpg" },
        { Id: 3314, TypeId: 10, FileName: "3314.mp4" }],
    Genres: ["Семейное кино", "сказка"], Directors: ["Режиссёр"],
    Countries: ["Россия"], Cast: ["Актёр"], PushkinId: "7555757", PzApiId: "cmb7uitmphlta0829m1gru88b",
});
const session = (id = 43864, movieId = 1196) => ({
    Id: id, Hall: { Id: 1, Name: "Малый зал" }, MovieId: movieId,
    DateTime: "2026-11-17T13:05:00", Format: { Id: 1, Name: "2D" },
    Locked: false, Deleted: false, Prices: [{ Id: 1, TicketId: 1, Name: "Стандартная", Sum: 345 }],
    PushkinId: null,
});

test("CinemaWebApi wall clock is parsed as Asia/Yekaterinburg UTC+05:00, not host timezone", () => {
    assert.equal(cinemaLocalToUtc("2026-11-17T13:05:00").toISOString(), "2026-11-17T08:05:00.000Z");
    assert.equal(cinemaLocalToUtc("2026-11-17T00:05:00.12").toISOString(), "2026-11-16T19:05:00.120Z");
    assert.equal(cinemaLocalToUtc("2026-11-17T00:05:00.1234567").toISOString(), "2026-11-16T19:05:00.123Z");
    for (const bad of ["2026-02-30T13:00:00", "2026-11-17T13:05:00+05:00", "2026-11-17T24:00:00", "2026-11-17T13:05:60"])
        assert.throws(() => cinemaLocalToUtc(bad));
});

test("movie maps metadata and preserves provider identifiers, without claiming Pushkin eligibility", () => {
    const m = normalizeCinemaMovie(movie());
    assert.equal(m.externalId, 1196);
    assert.equal(m.ageRating, "6+");
    assert.equal(m.durationMinutes, 105);
    assert.equal(m.media[0].typeId, 1);
    assert.equal(m.media[1].fileName, "3314.mp4");
    assert.equal(m.pushkinId, "7555757");
    assert.equal(m.genres.length, 2);
    assert.equal("pushkinCard" in m, false);
});

test("session maps prices from showPrices=true and computes minimum tariff", () => {
    const s = normalizeCinemaSession({ ...session(), Prices: [
        { Id: 1, Sum: 345, TicketName: "Билет" }, { Id: 2, Sum: 250, TicketName: "Льготный" },
    ] });
    assert.equal(s.startAt.toISOString(), "2026-11-17T08:05:00.000Z");
    assert.equal(s.minPriceRub, "250.00");
    assert.equal(s.hallName, "Малый зал");
    assert.equal(s.formatName, "2D");
    assert.equal(s.prices.length, 2);
    assert.equal(s.deleted, false);
    assert.equal(s.locked, false);
});

test("empty Prices remain unknown, never mislabelled free", () => {
    const s = normalizeCinemaSession({ ...session(), Prices: [] });
    assert.equal(s.minPriceRub, null);
});

test("empty or malformed feeds are rejected without touching database", () => {
    assert.throws(() => normalizeCinemaFeed([], [session()]));
    assert.throws(() => normalizeCinemaFeed([movie()], []));
    assert.throws(() => normalizeCinemaFeed(null, []));
    assert.throws(() => normalizeCinemaFeed([movie()], [session(5, 7890)]), /absent/);
    assert.throws(() => normalizeCinemaFeed([movie(), movie()], [session()]), /Duplicate/);
    assert.throws(() => normalizeCinemaFeed([movie()], [session(), session()]), /Duplicate/);
    assert.throws(() => normalizeCinemaFeed([movie()], [{...session(), DateTime: "bad"}]));
    assert.throws(() => normalizeCinemaFeed([movie()], [{...session(), Prices: [{Sum: -1}]}]));
});

test("only UUID service ID accepted and only GET endpoints called", async () => {
    assert.equal(validateCinemaServiceId("11111111-1111-4111-8111-111111111111").length, 36);
    assert.throws(() => validateCinemaServiceId("../../sale/pay"));
    const calls = [];
    const fakeFetch = async (url, init) => {
        calls.push({url, init});
        const data = url.includes("showPrices=true") ? [session()] : [movie()];
        return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(data)};
    };
    const feed = await fetchCinemaFeed("11111111-1111-4111-8111-111111111111", fakeFetch);
    assert.equal(feed.movies.length, 1);
    assert.equal(feed.sessions.length, 1);
    assert.deepEqual(calls.map(c=>c.init.method), ["GET","GET"]);
    assert.equal(calls.every(c=>c.init.redirect === "error"), true);
    assert.equal(calls.every(c=>!c.url.includes("/reservation/") && !c.url.includes("/sale/")), true);
});

test("transaction creates or updates movies before sessions and atomically marks missing rows stale", async () => {
    const events=[];
    const tx = {
        cinemaMovie:{updateMany:async()=>events.push("resetMovies"),upsert:async (x)=>events.push(`movie:${x.where.externalId}`)},
        cinemaSession:{updateMany:async()=>events.push("resetSessions"),upsert:async (x)=>events.push(`session:${x.where.externalId}`)},
    };
    const prisma = {$transaction:async (fn,opts)=>{ assert.equal(opts.timeout,60_000); return fn(tx); }};
    const feed=normalizeCinemaFeed([movie()],[session()]);
    const result=await applyCinemaFeed(prisma,feed);
    assert.deepEqual(result,{movies:1,sessions:1});
    assert.deepEqual(events,["resetSessions","resetMovies","movie:1196","session:43864"]);
});

test("deployment is a profiled one-shot tool, not a public endpoint or automatic sale", () => {
    const read = path => readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
    assert.match(read("compose.yaml"), /cinema-sync:/);
    assert.match(read("compose.yaml"), /profiles: \["tools"\]/);
    assert.match(read("Dockerfile.migrate"), /scripts\/sync-cinema\.mjs/);
    assert.match(read("scripts/sync-cinema.mjs"), /args\.includes\("--apply"\)/);
    assert.doesNotMatch(read("src/app/events/cinema/page.js"), /CinemaMovie/);
});
