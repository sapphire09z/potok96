import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cinemaSessionFingerprint, cinemaPushkinVerified,
    normalizeCinemaTicketUrl, publicCinemaTicketUrl } from "../src/lib/cinemaTicketPolicy.mjs";
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const row = (extra = {}) => ({
    externalId: 12345, movieExternalId: 543, startAt: new Date("2026-11-18T10:45:00Z"),
    hallExternalId: 1, hallName: "Киноконцертный зал", pushkinId: "7555757", ...extra,
});

test("default: API PushkinId alone does not publish a badge", () => {
    assert.equal(cinemaPushkinVerified(row()), false);
    assert.equal(publicCinemaTicketUrl(row()), "");
});
test("explicit approval bound to one exact screening enables badge", () => {
    const item = row(); item.verifiedPushkinId = item.pushkinId;
    item.pushkinVerifiedFingerprint = cinemaSessionFingerprint(item);
    assert.equal(cinemaPushkinVerified(item), true);
    assert.equal(cinemaPushkinVerified({ ...item, pushkinId: "7555773" }), false);
    assert.equal(cinemaPushkinVerified({ ...item, startAt: new Date("2026-11-18T11:45:00Z") }), false);
    assert.equal(cinemaPushkinVerified({ ...item, movieExternalId: 544 }), false);
});
test("confirmed HTTPS official deep link can be shown", () => {
    const item = row(); item.ticketUrl = "https://kinokruf.ru/schedule/movie-123/seat?session=12345";
    item.ticketVerifiedFingerprint = cinemaSessionFingerprint(item);
    assert.equal(publicCinemaTicketUrl(item), item.ticketUrl);
    assert.equal(publicCinemaTicketUrl({ ...item, hallName: "Малый зал" }), "");
});
test("unsafe links, impersonation, home pages and generic schedules are rejected", () => {
    for (const url of ["http://kinokruf.ru/schedule/movie", "https://kinokruf.ru.evil.test/buy",
        "https://kinokruf.ru@evil.test/schedule/movie", "https://kinokruf.ru/",
        "https://kinokruf.ru/schedule", "javascript:alert(1)",
        "https://example.com/ticket", "https://premierzal.ru:444/schedule/movie"])
        assert.throws(() => normalizeCinemaTicketUrl(url));
    assert.match(normalizeCinemaTicketUrl("https://premierzal.ru/schedule/abc"), /^https:/);
    assert.equal(publicCinemaTicketUrl({ ...row(), ticketUrl: "javascript:alert(1)",
        ticketVerifiedFingerprint: cinemaSessionFingerprint(row()) }), "");
});
test("database migration persists manual values apart from provider fields", () => {
    const sql = read("prisma/migrations/20261117190000_cinema_ticket_links/migration.sql");
    assert.match(sql, /ALTER TABLE "CinemaSession"/);
    assert.match(sql, /"verifiedPushkinId"/);
    assert.match(sql, /"ticketVerifiedFingerprint"/);
    const importer = read("src/lib/cinemaImport.mjs");
    assert.doesNotMatch(importer, /verifiedPushkinId:|ticketUrl:/);
});
test("public page only uses verified flags and no payment APIs", () => {
    const mapping = read("src/lib/cinemaCatalog.mjs");
    const page = read("src/app/events/cinema/page.js");
    assert.match(mapping, /cinemaPushkinVerified\(item\)/);
    assert.match(mapping, /publicCinemaTicketUrl\(item\)/);
    assert.match(page, /screening.pushkinCard/);
    assert.match(page, /screening.ticketUrl/);
    assert.match(page, /noopener noreferrer/);
    assert.doesNotMatch(page, /\/sale\/|ordersYandex|fetch\(/);
});
test("admin API enforces role, Origin, manual confirmation and date/version", () => {
    const api = read("src/app/api/admin/cinema/tickets/[id]/route.js");
    assert.match(api, /hasTrustedOrigin\(request\)/);
    assert.match(api, /getCurrentUser\(\)/);
    assert.match(api, /user.role !== "ADMIN"/);
    assert.match(api, /session.startAt <= new Date\(\)/);
    assert.match(api, /pushkinProofNote/);
    assert.match(api, /cinemaSessionFingerprint\(session\)/);
    assert.match(api, /updateMany/);
    assert.doesNotMatch(api, /\/sale\/|ordersYandex|fetch\(/);
});
test("admin page only fetches future current sessions and has per-session editor", () => {
    const page = read("src/app/admin/cinema/tickets/page.js");
    const client = read("src/app/admin/cinema/tickets/TicketAdminPanel.jsx");
    assert.match(page, /isCurrent: true/);
    assert.match(page, /deleted: false/);
    assert.match(page, /locked: false/);
    assert.match(client, /\/api\/admin\/cinema\/tickets\/\$\{initial.id\}/);
});
