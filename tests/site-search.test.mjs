import test from "node:test";
import assert from "node:assert/strict";
import { SEARCH_SECTIONS, searchPublicContent, searchQuery, searchSection } from "../src/lib/siteSearch.mjs";

const fixtures = {
    news: [
        { status: "published", slug: "city-news", title: "Новости Красноуфимска", summary: "Городская жизнь", date: "2026-11-15" },
        { status: "draft", slug: "secret", title: "Секретный проект", summary: "Не публиковать" },
    ],
    events: [{ status: "published", slug: "concert", title: "Концерт в городе", location: "Красноуфимск", startAt: "2026-11-17T15:00:00Z" }],
    orgs: [{ status: "published", slug: "theater", title: "Театр Ёлки", address: "улица Ленина" }],
    ads: [{ status: "published", slug: "bike", title: "Велосипед", content: "Продаю, адрес: улица Ленина" }],
    notices: [{ status: "published", slug: "official", title: "Постановление администрации", issuer: "Администрация", date: "2026-11-12" }],
    documents: [{ status: "published", slug: "act-1", title: "Распоряжение №123", number: "123", issuer: "Администрация", date: "2026-11-12" }],
    alerts: [{ status: "published", slug: "test-water", title: "Плановое отключение воды", addresses: "улица Ленина", source: "Водоканал" }],
};

test("search works across all seven public sections", () => {
    assert.equal(SEARCH_SECTIONS.length, 7);
    const all = searchPublicContent(fixtures, "улица Ленина");
    assert.deepEqual(all.results.map(r => r.type).sort(), ["ads", "alerts", "orgs"]);
});
test("drafts and unpublished cards never enter search results", () => {
    const result = searchPublicContent(fixtures, "Секретный");
    assert.equal(result.total, 0);
    assert.equal(searchPublicContent({ news: [{ ...fixtures.news[0], status: "unpublished" }] }, "Красноуфимска").total, 0);
});
test("case folding and Cyrillic ё normalization", () => {
    assert.equal(searchPublicContent(fixtures, "ТЕАТР ЕЛКИ").results[0].type, "orgs");
});
test("multiword search does not require adjacent words", () => {
    const result = searchPublicContent(fixtures, "отключение ленина");
    assert.equal(result.total, 1);
    assert.equal(result.results[0].type, "alerts");
});
test("section filters are allowlisted and counts stay global", () => {
    const r = searchPublicContent(fixtures, "улица Ленина", "alerts");
    assert.equal(r.total, 1);
    assert.equal(r.counts.orgs, 1);
    assert.equal(searchSection("../../admin"), "");
});
test("search title match is ranked before content-only match", () => {
    const r = searchPublicContent(fixtures, "Красноуфимск");
    assert.equal(r.results[0].type, "news");
});
test("document links target the existing public register", () => {
    const r = searchPublicContent(fixtures, "123");
    assert.equal(r.results[0].url, "/official/documents?q=" + encodeURIComponent("Распоряжение №123"));
});
test("alerts link to stable public anchors", () => {
    assert.equal(searchPublicContent(fixtures, "отключение").results[0].url, "/alerts#alert-test-water");
});
test("query input is bounded, unsafe items cannot create external links", () => {
    assert.equal(searchQuery("x".repeat(200)).length, 120);
    assert.equal(searchPublicContent(fixtures, " ").total, 0);
    assert.equal(searchPublicContent({ news: [{ status: "published", slug: "//evil.com", title: "Материал" }] }, "Материал").results[0].url, "/news/%2F%2Fevil.com");
});
test("missing collections are accepted as empty sets", () => {
    assert.equal(searchPublicContent({}, "вода").total, 0);
});
test("each of seven sections exposes its own published item", () => {
    const words = [
        ["news", "Новости Красноуфимска"],
        ["events", "Концерт в городе"],
        ["orgs", "Театр Ёлки"],
        ["ads", "Велосипед"],
        ["notices", "Постановление администрации"],
        ["documents", "Распоряжение №123"],
        ["alerts", "Плановое отключение воды"],
    ];
    for (const [section, query] of words) {
        const result = searchPublicContent(fixtures, query, section);
        assert.equal(result.total, 1, section);
        assert.equal(result.results[0].type, section);
    }
});
