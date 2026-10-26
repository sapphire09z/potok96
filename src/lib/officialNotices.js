
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const noticesDir = path.join(
    process.cwd(),
    "content",
    "official",
    "notices"
);

export function getAllOfficialNotices() {
    if (!fs.existsSync(noticesDir)) return [];

    return fs
        .readdirSync(noticesDir)
        .filter((file) => file.endsWith(".md"))
        .map((file) => {
            const raw = fs.readFileSync(
                path.join(noticesDir, file),
                "utf8"
            );

            const { data, content } = matter(raw);

            const date =
                data.date instanceof Date
                    ? data.date.toISOString().slice(0, 10)
                    : String(data.date ?? "");

            return {
                slug: path.basename(file, ".md"),
                title: String(data.title ?? ""),
                date,
                issuer: String(data.issuer ?? ""),
                summary: String(data.summary ?? ""),
                sourceUrl: String(data.sourceUrl ?? ""),
                locality: String(data.locality ?? ""),
                status: String(data.status ?? "draft"),
                content: content.trim(),
            };
        })
        .filter(
            (item) =>
                item.status === "published" &&
                item.title &&
                /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        )
        .sort((a, b) => b.date.localeCompare(a.date));
}

export function getOfficialNoticeBySlug(slug) {
    return (
        getAllOfficialNotices().find(
            (item) => item.slug === slug
        ) ?? null
    );
}
