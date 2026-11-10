// Asia/Yekaterinburg is UTC+05:00. Expiration is the inclusive end of the
// chosen calendar day in the city, independent of the VPS time zone.
const YEKAT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function placementEndFromDate(day) {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const utcMidnight = Date.parse(`${day}T00:00:00.000Z`);
    if (!Number.isFinite(utcMidnight) ||
        new Date(utcMidnight).toISOString().slice(0, 10) !== day) return null;
    return new Date(`${day}T23:59:59.999+05:00`);
}

export function placementDateInYekat(value) {
    if (value == null) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() + YEKAT_OFFSET_MS).toISOString().slice(0, 10);
}

export function isExtendedPlacement(org, now = new Date()) {
    if (org?.placement !== "EXTENDED" || !org.extendedUntil) return false;
    const until = new Date(org.extendedUntil).getTime();
    const current = new Date(now).getTime();
    return Number.isFinite(until) && Number.isFinite(current) && until >= current;
}

export function effectiveOrgPlacement(org, now = new Date()) {
    return isExtendedPlacement(org, now) ? "EXTENDED" : "BASIC";
}
