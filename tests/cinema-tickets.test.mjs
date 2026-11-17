import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    cinemaFilmPushkinCard, normalizeCinemaMoviePageUrl, cinemaTicketDateLink,
} from "../src/lib/cinemaTicketPolicy.mjs";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const base = "https://kinokruf.ru/schedule/cmb7uitmphlta0829m1gru88b";
const movie = ({ pushkinId = "7555757", ticketPageUrl = base } = {}) => ({ pushkinId, ticketPageUrl });
const session = startAt => ({ startAt: new Date(startAt) });

test("Pushkin Card is a film-level label coming from the Premier Zal movie feed", () => {
    assert.equal(cinemaFilmPushkinCard(movie()), true);
    assert.equal(cinemaFilmPushkinCard(movie({ pushkinId: "" })), false);
    assert.equal(cinemaFilmPushkinCard(movie({ pushkinId: "no" })), false);
    assert.equal(cinemaFilmPushkinCard({ pushkinId: 7555757 }), false);
});
test("accepts exactly the verified HTTPS film-path shape, without parameters", () => {
    assert.equal(normalizeCinemaMoviePageUrl(base), base);
    assert.equal(normalizeCinemaMoviePageUrl(""), "");
    for (const unsafe of ["http://kinokruf.ru/schedule/cmb7uitmphlta0829m1gru88b",
        "https://kinokruf.ru.evil.test/schedule/cmb7uitmphlta0829m1gru88b",
        "https://kinokruf.ru@evil.test/schedule/cmb7uitmphlta0829m1gru88b",
        "https://kinokruf.ru/", "https://kinokruf.ru/schedule",
        "https://kinokruf.ru/schedule/cmb7uitmphlta0829m1gru88b?date=18.11.2026",
        "https://kinokruf.ru/schedule/cmb7uitmphlta0829m1gru88b#frag",
        "javascript:alert(1)", "https://kinokruf.ru:8443/schedule/cmb7uitmphlta0829m1gru88b",
        "https://premierzal.ru/schedule/cmb7uitmphlta0829m1gru88b",
        "https://kinokruf.ru/schedule/a"])
        assert.throws(() => normalizeCinemaMoviePageUrl(unsafe));
});
test("converts UTC to the Krasnoufimsk date rather than the server date", () => {
    const s = session("2026-11-17T20:30:00.000Z"); // 18 Nov 01:30 in Yekaterinburg
    assert.equal(cinemaTicketDateLink(movie(), s), `${base}?date=18.11.2026&format=`);
    assert.equal(cinemaTicketDateLink(movie(), session("2026-11-18T09:45:00.000Z")),
        `${base}?date=18.11.2026&format=`);
});
test("no film mapping or invalid date means no external buy link", () => {
    assert.equal(cinemaTicketDateLink(movie({ ticketPageUrl: "" }), session("2026-11-18T09:45:00Z")), "");
    assert.equal(cinemaTicketDateLink(movie({ ticketPageUrl: "http://evil.test" }), session("2026-11-18T09:45:00Z")), "");
    assert.equal(cinemaTicketDateLink(movie(), { startAt: "2026-11-18T09:45:00Z" }), "");
});
test("migration adds a film-level address, leaving per-session records intact", () => {
    const migration = read("prisma/migrations/20261117200000_cinema_movie_page_links/migration.sql");
    assert.match(migration, /ALTER TABLE "CinemaMovie" ADD COLUMN "ticketPageUrl"/);
    assert.doesNotMatch(migration, /DROP|DELETE|TRUNCATE/);
    const importer = read("src/lib/cinemaImport.mjs");
    assert.doesNotMatch(importer, /ticketPageUrl/);
});
test("public cinema page places the badge on the film, not the session", () => {
    const map = read("src/lib/cinemaCatalog.mjs");
    const page = read("src/app/events/cinema/page.js");
    assert.match(map, /pushkinCard: cinemaFilmPushkinCard\(row\)/);
    assert.match(map, /ticketUrl: cinemaTicketDateLink\(row, item\)/);
    assert.match(page, /movie.pushkinCard/);
    assert.doesNotMatch(page, /screening.pushkinCard/);
    assert.match(page, /noopener noreferrer/);
    assert.doesNotMatch(page, /\/sale\/|ordersYandex|fetch\(/);
});
test("film admin endpoint uses trusted Origin, ADMIN, optimistic movie revision", () => {
    const api = read("src/app/api/admin/cinema/tickets/[id]/route.js");
    assert.match(api, /hasTrustedOrigin\(request\)/);
    assert.match(api, /user.role !== "ADMIN"/);
    assert.match(api, /db.cinemaMovie.findUnique/);
    assert.match(api, /db.cinemaMovie.updateMany/);
    assert.match(api, /expectedUpdatedAt/);
    assert.doesNotMatch(api, /pushkinProofNote|verifiedPushkinId|db.cinemaSession|\/sale\/|ordersYandex|fetch\(/);
});
test("admin lists movies and no longer edits individual showtimes or proof notes", () => {
    const page = read("src/app/admin/cinema/tickets/page.js");
    const client = read("src/app/admin/cinema/tickets/TicketAdminPanel.jsx");
    assert.match(page, /cinemaMovie.findMany/);
    assert.match(client, /ticketPageUrl/);
    assert.doesNotMatch(client, /pushkinProofNote|pushkinConfirmed|pushkinVerifiedFingerprint/);
    assert.match(client, /Дата выбирается автоматически/i);
});
