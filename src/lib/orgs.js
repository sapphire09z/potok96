import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ORGS_DIR = path.join(process.cwd(), "content", "orgs");

export async function getAllOrgs() {
    const files = await fs.readdir(ORGS_DIR);

    const items = await Promise.all(
        files
            .filter((f) => f.endsWith(".md"))
            .map(async (filename) => {
                const fullPath = path.join(ORGS_DIR, filename);
                const raw = await fs.readFile(fullPath, "utf8");
                const { data } = matter(raw);

                return {
                    slug: data.slug,
                    title: data.title,
                    type: data.type ?? "",
                    address: data.address ?? "",
                    phone: data.phone ?? "",
                    hours: data.hours ?? "",
                    tags: data.tags ?? [],
                    status: data.status ?? "draft",
                };
            })
    );

    return items.filter((o) => o.status === "published");
}

export async function getOrgBySlug(slug) {
    const files = await fs.readdir(ORGS_DIR);

    for (const filename of files) {
        if (!filename.endsWith(".md")) continue;

        const fullPath = path.join(ORGS_DIR, filename);
        const raw = await fs.readFile(fullPath, "utf8");
        const { data, content } = matter(raw);

        if (data.slug === slug) {
            return {
                slug: data.slug,
                title: data.title,
                type: data.type ?? "",
                address: data.address ?? "",
                phone: data.phone ?? "",
                hours: data.hours ?? "",
                tags: data.tags ?? [],
                status: data.status ?? "draft",
                content,
            };
        }
    }

    return null;
}