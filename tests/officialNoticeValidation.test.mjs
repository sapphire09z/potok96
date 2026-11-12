import test from "node:test";
import assert from "node:assert/strict";
import { validateOfficialNotice, validNoticeDate, validNoticeVersion } from "../src/lib/officialNoticeValidation.mjs";

const good = Object.freeze({
    slug: "municipal-notice-2026", title: "Объявление администрации",
    date: "2026-11-20", issuer: "Администрация городского округа Красноуфимск",
    locality: "Красноуфимск", summary: "Служебное сообщение",
    sourceUrl: "https://example.org/news/1", content: "**Текст** сообщения.",
});

test("accept valid official notices with strict field set", () => {
    assert.deepEqual(validateOfficialNotice(good), good);
});

test("reject missing or unexpected fields", () => {
    assert.equal(validateOfficialNotice({ ...good, arbitrary: "extra" }), null);
    const { content, ...withoutContent } = good;
    assert.equal(validateOfficialNotice(withoutContent), null);
});

test("reject invalid and normalized dates including February 30", () => {
    assert.ok(validNoticeDate("2024-02-29"));
    for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-1-01", "2101-01-01"])
        assert.equal(validNoticeDate(date), false, date);
});

test("reject unsafe URLs, usernames, markup in slug and control characters", () => {
    for (const sourceUrl of ["http://example.org", "javascript:alert(1)", "https://a:b@example.org/"])
        assert.equal(validateOfficialNotice({ ...good, sourceUrl }), null);
    assert.equal(validateOfficialNotice({ ...good, slug: "../escape" }), null);
    assert.equal(validateOfficialNotice({ ...good, content: "a\u0000b" }), null);
});

test("require title, issuer and content", () => {
    for (const key of ["title", "issuer", "content"])
        assert.equal(validateOfficialNotice({ ...good, [key]: "  " }), null);
});

test("optimistic version is strict ISO milliseconds", () => {
    assert.ok(validNoticeVersion("2026-11-12T08:20:40.123Z"));
    assert.equal(validNoticeVersion("2026-11-12T08:20Z"), false);
    assert.equal(validNoticeVersion("2026-11-12T08:20:40+05:00"), false);
});
