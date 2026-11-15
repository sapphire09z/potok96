import test from "node:test";
import assert from "node:assert/strict";
import {
    ALERT_ID, validateServiceAlert, parseYekaterinburgDateTime,
    toYekaterinburgInput, validAlertVersion, isServiceAlertPublicationReady,
} from "../src/lib/serviceAlertValidation.mjs";
import { mergeServiceAlerts } from "../src/lib/serviceAlertMerge.mjs";

const good = {
    slug: "test-outage-593", title: "Проверка уведомления", service: "water", state: "planned",
    urgency: "normal", confirmed: false, startAt: "2026-11-15T09:30",
    expectedEndAt: "2026-11-15T16:00", restoredAt: "", addresses: "Улица, дома 1–3",
    source: "Диспетчерская служба", sourceUrl: "https://example.org/info", content: "Тест",
};
const parse = (overrides = {}) => validateServiceAlert({ ...good, ...overrides });

test("normalizes metadata and converts local Ekaterinburg time to UTC", () => {
    const result = parse({ title: "  Проверка уведомления  " });
    assert.equal(result.title, good.title);
    assert.equal(result.startAt.toISOString(), "2026-11-15T04:30:00.000Z");
    assert.equal(toYekaterinburgInput(result.startAt), good.startAt);
});
test("rejects extra and missing fields, invalid confirmation type", () => {
    assert.equal(parse({ unexpected: true }), null);
    const { slug, ...incomplete } = good;
    assert.equal(validateServiceAlert(incomplete), null);
    assert.equal(parse({ confirmed: "true" }), null);
    assert.equal(validateServiceAlert([]), null);
});
test("rejects invalid slugs and enum values", () => {
    for (const slug of ["X", "../config", "upper-CASE", "a--b", "a b"])
        assert.equal(parse({ slug }), null);
    for (const service of ["internet", "", "WATER"]) assert.equal(parse({ service }), null);
    assert.equal(parse({ state: "unknown" }), null);
    assert.equal(parse({ urgency: "emergency" }), null);
});
test("rejects impossible dates, reversed intervals and incorrect restored time", () => {
    for (const value of ["2026-02-30T09:00", "2026-11-15T24:00", "2026-13-01T00:00", "2026-11-15", "200-01-01T12:00"])
        assert.equal(parseYekaterinburgDateTime(value), undefined);
    assert.equal(parse({ expectedEndAt: "2026-11-15T08:00" }), null);
    assert.equal(parse({ restoredAt: "2026-11-15T12:00" }), null);
    assert.equal(parse({ state: "restored", restoredAt: "2026-11-15T07:00" }), null);
});
test("does not accept unsafe URLs or Unicode spoofing controls", () => {
    for (const url of ["http://example.org", "javascript:alert(1)", "https://x:y@example.org"])
        assert.equal(parse({ sourceUrl: url }), null);
    assert.equal(parse({ title: "Служба\nвода" }), null);
    assert.equal(parse({ source: "\u202EПодмена" }), null);
});
test("enforces limits and permits multi-line content", () => {
    assert.equal(parse({ content: "x".repeat(20001) }), null);
    assert.equal(parse({ addresses: "x".repeat(1001) }), null);
    assert.ok(parse({ content: "Первый абзац\nВторой абзац" }));
});
test("publication requires explicit confirmation and trusted source", () => {
    assert.equal(isServiceAlertPublicationReady(parse()), false);
    assert.equal(isServiceAlertPublicationReady(parse({ confirmed: true, source: "" })), false);
    assert.equal(isServiceAlertPublicationReady(parse({ confirmed: true })), true);
    assert.equal(isServiceAlertPublicationReady(parse({ confirmed: true, state: "restored" })), false);
    assert.equal(isServiceAlertPublicationReady(parse({ confirmed: true, state: "restored", restoredAt: "2026-11-15T15:00" })), true);
});
test("version header and cuid are strict", () => {
    assert.equal(validAlertVersion("2026-11-15T08:30:00.000Z"), true);
    assert.equal(validAlertVersion("2026-11-15"), false);
    assert.equal(ALERT_ID.test("c" + "a".repeat(24)), true);
    assert.equal(ALERT_ID.test("../"), false);
});
test("legacy Markdown reserves its slug, including unpublished files", () => {
    const legacy = [{ slug: "old-alert", status: "draft" }];
    const cms = [{ slug: "old-alert" }, { slug: "filename" }, { slug: "new-alert" }];
    const result = mergeServiceAlerts(legacy, cms, new Set(["filename"]));
    assert.deepEqual(result.map(x => x.slug), ["old-alert", "new-alert"]);
    assert.equal(result[1].status, "published");
});
