import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cinemaMovieToPublic, cinemaMoviesToPublic } from "../src/lib/cinemaCatalog.mjs";

const now = new Date("2026-11-17T06:00:00.000Z");
const session = (overrides = {}) => ({
    externalId: 43864, isCurrent: true, deleted: false, locked: false,
    startAt: new Date("2026-11-17T08:05:00.000Z"),
    minPriceRub: { toString: () => "345.00" }, hallName: "Малый зал", formatName: "2D", pushkinId: "7555757",
    ...overrides,
});
const movie = (overrides = {}) => ({
    externalId: 1208, isCurrent: true, title: "Лучшее лето в жизни", ageRating: "6+",
    durationMinutes: 105, genres: ["Комедия", "Приключения"], story: "Описание фильма",
    media: [{ id: 3315, typeId: 1, fileName: "3315.jpg" }], pushkinId: "7555757",
    sessions: [session()], ...overrides,
});

test("maps PostgreSQL movie and screening fields, including Decimal ticket price", () => {
    const row = cinemaMovieToPublic(movie(), now);
    assert.equal(row.title, "Лучшее лето в жизни");
    assert.equal(row.ageRating, "6+");
    assert.equal(row.genre, "Комедия · Приключения");
    assert.equal(row.durationMinutes, 105);
    assert.equal(row.screenings[0].price, 345);
    assert.equal(row.screenings[0].startAt, "2026-11-17T08:05:00.000Z");
    assert.equal(row.screenings[0].hallName, "Малый зал");
});

test("hides stale, cancelled, locked and past screenings", () => {
    const rows = [session(), session({ externalId: 2, locked: true }),
        session({ externalId: 3, deleted: true }), session({ externalId: 4, isCurrent: false }),
        session({ externalId: 5, startAt: new Date("2026-11-17T05:59:59Z") })];
    assert.equal(cinemaMovieToPublic(movie({ sessions: rows }), now).screenings.length, 1);
    assert.equal(cinemaMovieToPublic(movie({ isCurrent: false }), now), null);
    assert.equal(cinemaMovieToPublic(movie({ sessions: rows.slice(1) }), now), null);
});

test("orders films by nearest screening, and screenings by time", () => {
    const late = session({ externalId: 77, startAt: new Date("2026-11-17T13:00:00Z") });
    const early = session({ externalId: 31, startAt: new Date("2026-11-17T07:00:00Z") });
    const cards = cinemaMoviesToPublic([movie({ externalId: 1, sessions: [late] }), movie({ externalId: 2, sessions: [late, early] })], now);
    assert.deepEqual(cards.map(c => c.slug), ["cinema-2", "cinema-1"]);
    assert.deepEqual(cards[0].screenings.map(s => s.id), [31, 77]);
});

test("zero price is free, missing price is unknown", () => {
    assert.equal(cinemaMovieToPublic(movie({ sessions: [session({ minPriceRub: 0 })] }), now).screenings[0].price, 0);
    assert.equal(cinemaMovieToPublic(movie({ sessions: [session({ minPriceRub: null })] }), now).screenings[0].price, null);
});

test("unverified poster and tickets stay hidden and Pushkin badge is not asserted", () => {
    const row = cinemaMovieToPublic(movie(), now);
    assert.equal(row.poster, "");
    assert.equal(row.screenings[0].ticketUrl, "");
    assert.equal(row.screenings[0].pushkinCard, false);
});

test("limits public synopsis length without changing provider database records", () => {
    const story = "К".repeat(2000);
    const row = cinemaMovieToPublic(movie({ story }), now);
    assert.ok(row.summary.length <= 650);
    assert.equal(story.length, 2000);
});

test("PostgreSQL feed only: active movies and future sessions", () => {
    const source = readFileSync(new URL("../src/lib/cinemaMovies.js", import.meta.url), "utf8");
    assert.match(source, /getPrisma\(\)\.cinemaMovie\.findMany/);
    assert.match(source, /isCurrent: true/);
    assert.match(source, /deleted: false/);
    assert.match(source, /locked: false/);
    assert.match(source, /startAt: \{ gte: now \}/);
    assert.doesNotMatch(source, /http:\/\/|fetch\(/i);
});

test("no booking or payment mutations, no public API routes added", () => {
    const source = readFileSync(new URL("../src/lib/cinemaCatalog.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(source, /\.create\(|\.update\(|\.delete\(|\.post\(/);
});
