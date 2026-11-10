import test from "node:test";
import assert from "node:assert/strict";
import { validateOrgPremium, publicOrgPremium } from "../src/lib/orgPremium.js";
import { placementEndFromDate } from "../src/lib/orgPlacement.js";

const valid = () => ({
    priceItems: [{ title: "Стрижка", price: "от 500 ₽", description: "По записи" }],
    specialOffers: [{ title: "Акция", description: "Скидка 10%" }],
    extraLinks: [{ label: "Записаться", url: "https://example.org/book" }],
});

test("accepts strictly validated price list, offers, HTTPS links", () => {
    assert.deepEqual(validateOrgPremium(valid()), valid());
});

test("rejects unsafe links and unknown fields", () => {
    const javascriptLink = valid(); javascriptLink.extraLinks[0].url = "javascript:alert(1)";
    assert.equal(validateOrgPremium(javascriptLink), null);
    const credentialLink = valid(); credentialLink.extraLinks[0].url = "https://user:pass@example.org/";
    assert.equal(validateOrgPremium(credentialLink), null);
    const extraField = valid(); extraField.priceItems[0].hidden = "oops";
    assert.equal(validateOrgPremium(extraField), null);
});

test("rejects over-limit and missing data", () => {
    const tooMany = valid(); tooMany.priceItems = Array(17).fill(valid().priceItems[0]);
    assert.equal(validateOrgPremium(tooMany), null);
    assert.equal(validateOrgPremium({ ...valid(), specialOffers: undefined }), null);
});

test("premium is hidden for BASIC or expired placements and retained for active", () => {
    const now = new Date("2026-11-10T10:00:00Z");
    const until = placementEndFromDate("2026-11-10");
    const row = { ...valid(), placement: "EXTENDED", extendedUntil: until };
    assert.deepEqual(publicOrgPremium(row, now), valid());
    assert.deepEqual(publicOrgPremium({ ...row, placement: "BASIC" }, now).priceItems, []);
    assert.deepEqual(publicOrgPremium(row, new Date("2026-11-10T19:00:00Z")),
        { priceItems: [], specialOffers: [], extraLinks: [] });
});
