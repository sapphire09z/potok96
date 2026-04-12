import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const EVENTS_DIR = path.join(process.cwd(), "content", "events");

export async function getAllEvents() {
    const files = await fs.readdir(EVENTS_DIR);

    const items = await Promise.all(
        files
            .filter((f) => f.endsWith(".md"))
            .map(async (filename) => {
                const fullPath = path.join(EVENTS_DIR, filename);
                const raw = await fs.readFile(fullPath, "utf8");
                const { data } = matter(raw);

                return {
                    slug: data.slug,
                    title: data.title,
                    startAt: data.startAt,
                    endAt: data.endAt ?? null,
                    location: data.location ?? "",
                    price: data.price ?? "",
                    summary: data.summary ?? "",
                    org: data.org ?? null,
                    status: data.status ?? "draft",
                };
            })
    );

    // показываем только published и сортируем по времени начала (сначала ближайшие)
    return items
        .filter((e) => e.status === "published")
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

export async function getEventBySlug(slug) {
    const files = await fs.readdir(EVENTS_DIR);

    for (const filename of files) {
        if (!filename.endsWith(".md")) continue;

        const fullPath = path.join(EVENTS_DIR, filename);
        const raw = await fs.readFile(fullPath, "utf8");
        const { data, content } = matter(raw);

        if (data.slug === slug) {
            return {
                slug: data.slug,
                title: data.title,
                startAt: data.startAt,
                endAt: data.endAt ?? null,
                location: data.location ?? "",
                price: data.price ?? "",
                summary: data.summary ?? "",
                org: data.org ?? null,
                status: data.status ?? "draft",
                content,
            };
        }
    }

    return null;
}
