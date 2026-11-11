import test from "node:test";
import assert from "node:assert/strict";
import { validateEventFields, localEventTime, toEventLocalTime, eventToPublic, isEventVersion } from "../src/lib/eventAdmin.mjs";

const example = {
    title: "День города", slug: "den-goroda-2027", category: "concert",
    startAt: "2027-07-10T17:30", endAt: "2027-07-10T20:00",
    location: "Красноуфимск", price: "500 ₽", isFree: false, pushkinCard: false,
    pushkinProofUrl: "", summary: "Открытая площадка", cover: "/media/events/den-goroda.webp",
    orgSlug: "kosmos", video: "", content: "## Программа\nВыступления артистов",
};

test("validates exact whitelist, category, local time and public mapping", () => {
    const result = validateEventFields(example);
    assert.ok(result);
    assert.equal(result.startAt.toISOString(), "2027-07-10T12:30:00.000Z");
    assert.equal(result.endAt.toISOString(), "2027-07-10T15:00:00.000Z");
    assert.equal(toEventLocalTime(result.startAt), example.startAt);
    assert.equal(eventToPublic({ ...result, status: "PUBLISHED" }).status, "published");
    assert.equal(eventToPublic(result).org, "kosmos");
});

test("rejects malicious content, unknown fields, invalid dates and unapproved external embeds", () => {
    for (const [key, value] of [
        ["startAt", "2027-02-30T09:00"], ["endAt", "2027-07-09T00:00"],
        ["startAt", "2027-07-10T17:30Z"], ["slug", "../admin"],
        ["category", "__proto__"], ["cover", "//evil.com/x.jpg"],
        ["cover", "/media/events/../../secret.png"],
        ["orgSlug", "X X"], ["title", "Bad\u202etitle"],
        ["video", "https://evil.example/embed/hello"],
        ["pushkinCard", "true"],
    ]) assert.equal(validateEventFields({ ...example, [key]: value }), null, key);
    assert.equal(validateEventFields({ ...example, publication: "PUBLISHED" }), null);
    assert.equal(localEventTime("2026-02-29T12:00", true), undefined);
});

test("Pushkin Card requires source and only paid events may carry it", () => {
    assert.equal(validateEventFields({ ...example, pushkinCard: true }), null);
    assert.ok(validateEventFields({ ...example, pushkinCard: true,
        pushkinProofUrl: "https://www.culture.ru/" }));
    assert.equal(validateEventFields({ ...example, isFree: true, price: "0", pushkinCard: false }), null);
    assert.equal(validateEventFields({ ...example, isFree: true, price: "", pushkinCard: true,
        pushkinProofUrl: "https://www.culture.ru/" }), null);
});

test("accepts only strict optimistic versions and known embed providers", () => {
    assert.equal(isEventVersion("2026-11-11T10:00:00.000Z"), true);
    assert.equal(isEventVersion("2026-11-11"), false);
    assert.ok(validateEventFields({ ...example, video: "https://www.youtube-nocookie.com/embed/Abc_1234-Xy" }));
    assert.equal(validateEventFields({ ...example, video: "https://www.youtube-nocookie.com/embed/Abc_1234-Xy?autoplay=1" }), null);
});
