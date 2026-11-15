// Pure merge policy: legacy Markdown (including drafts) reserves its slug.
export function mergeServiceAlerts(legacy, cms, reserved) {
    const used = new Set(reserved);
    for (const item of legacy) if (item.slug) used.add(item.slug);
    const fresh = cms.filter(item => !used.has(item.slug)).map(item => ({ ...item, status: "published" }));
    return [...legacy, ...fresh];
}
