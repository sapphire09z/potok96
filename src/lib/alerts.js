
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";
import { mergeServiceAlerts } from "@/lib/serviceAlertMerge.mjs";

const ALERTS_DIR = path.join(process.cwd(), "content", "alerts");

async function getAllLegacyAlerts() {
    const files = await fs.readdir(ALERTS_DIR);

    const alerts = await Promise.all(
        files
            .filter((filename) => filename.endsWith(".md"))
            .map(async (filename) => {
                const raw = await fs.readFile(
                    path.join(ALERTS_DIR, filename),
                    "utf8"
                );

                const { data, content } = matter(raw);

                return {
                    slug: data.slug ?? path.basename(filename, ".md"),
                    title: data.title,
                    service: data.service ?? "other",
                    status: data.status ?? "draft",
                    state: data.state ?? "planned",
                    urgency: data.urgency ?? "normal",
                    confirmed: data.confirmed === true,
                    startAt: data.startAt ?? null,
                    expectedEndAt: data.expectedEndAt ?? null,
                    addresses: data.addresses ?? "",
                    source: data.source ?? "",
                    content,
                };
            })
    );

    return alerts;
}

// Stage 5.9.3: published CMS records augment existing read-only Markdown.
// Legacy names (including drafts and filenames) always take precedence.
export async function getAllAlerts() {
    const legacy = await getAllLegacyAlerts();
    const files = await fs.readdir(ALERTS_DIR);
    const reserved = new Set(files.filter(f => f.endsWith(".md"))
        .map(f => path.basename(f, ".md")));
    const rows = await getPrisma().serviceAlert.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, title: true, service: true, state: true,
            urgency: true, confirmed: true, startAt: true, expectedEndAt: true,
            restoredAt: true, addresses: true, source: true, sourceUrl: true, content: true },
        orderBy: [{ startAt: "desc" }, { id: "desc" }],
    });
    const cms = rows.map(row => ({ ...row,
        startAt: row.startAt.toISOString(),
        expectedEndAt: row.expectedEndAt?.toISOString() ?? null,
        restoredAt: row.restoredAt?.toISOString() ?? null,
    }));
    return mergeServiceAlerts(legacy, cms, reserved);
}

export async function getCurrentAlerts() {
    const alerts = await getAllAlerts();

    const rank = (alert) => {
        if (alert.urgency === "urgent" && alert.state === "active") {
            return 0;
        }

        return alert.state === "active" ? 1 : 2;
    };

    return alerts
        .filter((alert) => alert.status === "published")
        .filter((alert) => ["planned", "active"].includes(alert.state))
        .sort((a, b) => {
            const priority = rank(a) - rank(b);

            if (priority !== 0) return priority;

            return (
                (new Date(a.startAt).getTime() || Infinity) -
                (new Date(b.startAt).getTime() || Infinity)
            );
        });
}
