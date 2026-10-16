
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ALERTS_DIR = path.join(process.cwd(), "content", "alerts");

export async function getAllAlerts() {
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
                    slug: data.slug,
                    title: data.title,
                    service: data.service ?? "other",
                    status: data.status ?? "draft",
                    state: data.state ?? "planned",
                    urgency: data.urgency ?? "normal",
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
