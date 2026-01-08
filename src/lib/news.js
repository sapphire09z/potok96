import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const NEWS_DIR = path.join(process.cwd(), "content", "news");

export async function getAllNews() {
    const files = await fs.readdir(NEWS_DIR);

    const items = await Promise.all(
        files
            .filter((f) => f.endsWith(".md"))
            .map(async (filename) => {
                const fullPath = path.join(NEWS_DIR, filename);
                const raw = await fs.readFile(fullPath, "utf8");

                const { data } = matter(raw);

                return {
                    slug: data.slug,
                    title: data.title,
                    date: data.date,
                    summary: data.summary ?? "",
                    status: data.status ?? "draft",
                };
            })
    );

    return items
        .filter((p) => p.status === "published")
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}
export async function getNewsBySlug(slug) {
    const files = await fs.readdir(NEWS_DIR);

    for (const filename of files) {
        if (!filename.endsWith(".md")) continue;

        const fullPath = path.join(NEWS_DIR, filename);
        const raw = await fs.readFile(fullPath, "utf8");
        const { data, content } = matter(raw);

        if (data.slug === slug) {
            return {
                slug: data.slug,
                title: data.title,
                date: data.date,
                summary: data.summary ?? "",
                status: data.status ?? "draft",
                content, // пока просто сырой markdown-текст
            };
        }
    }

    return null;
}