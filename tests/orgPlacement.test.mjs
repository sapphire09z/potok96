import test from "node:test";
import assert from "node:assert/strict";
import { placementEndFromDate, placementDateInYekat,
    effectiveOrgPlacement, isExtendedPlacement } from "../src/lib/orgPlacement.js";

test("valid end-of-day uses Asia/Yekaterinburg (UTC+5)", () => {
    assert.equal(placementEndFromDate("2026-11-30").toISOString(), "2026-11-30T18:59:59.999Z");
    assert.equal(placementDateInYekat("2026-11-30T18:59:59.999Z"), "2026-11-30");
    assert.equal(placementEndFromDate("2026-02-30"), null);
    assert.equal(placementEndFromDate("2026-13-01"), null);
    assert.equal(placementEndFromDate("30.11.2026"), null);
});

test("extended tier expires automatically without a background job", () => {
    const org = { placement: "EXTENDED", extendedUntil: placementEndFromDate("2026-11-30") };
    assert.equal(isExtendedPlacement(org, "2026-11-30T18:59:59.998Z"), true);
    assert.equal(effectiveOrgPlacement(org, "2026-11-30T18:59:59.998Z"), "EXTENDED");
    assert.equal(isExtendedPlacement(org, "2026-11-30T18:59:59.999Z"), true);
    assert.equal(isExtendedPlacement(org, "2026-11-30T19:00:00.000Z"), false);
    assert.equal(effectiveOrgPlacement(org, "2026-11-30T19:00:00.000Z"), "BASIC");
    assert.equal(effectiveOrgPlacement({ ...org, placement: "BASIC" }, "2026-11-01T00:00:00Z"), "BASIC");
    assert.equal(effectiveOrgPlacement({ placement: "EXTENDED", extendedUntil: null }), "BASIC");
});
