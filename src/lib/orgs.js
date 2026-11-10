import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";
import { organizationToPublic } from "@/lib/orgAdmin";

const ORGS_DIR = path.join(process.cwd(), "content", "orgs");

async function getAllMarkdownOrgs() {
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

                    category: data.category ?? "other",
                    area: data.area === "district" ? "district" : "city",
                    locality:
                        typeof data.locality === "string"
                            ? data.locality.trim()
                            : data.area === "district"
                                ? ""
                                : "Красноуфимск",

                    address: data.address ?? "",
                    phone: data.phone ?? "",
                    hours: data.hours ?? "",
                    tags: data.tags ?? [],
                    services: Array.isArray(data.services) ? data.services : [],
                    logo: data.logo ?? "",
                    cover: data.cover ?? "",
                    status: data.status ?? "draft",
                };
            })
    );

    return items.filter((o) => o.status === "published");
}

async function getMarkdownOrgBySlug(slug) {
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

                category: data.category ?? "other",
                area: data.area === "district" ? "district" : "city",
                locality:
                    typeof data.locality === "string"
                        ? data.locality.trim()
                        : data.area === "district"
                            ? ""
                            : "Красноуфимск",

                address: data.address ?? "",
                phone: data.phone ?? "",
                hours: data.hours ?? "",
                tags: data.tags ?? [],
                services: Array.isArray(data.services) ? data.services : [],
                logo: data.logo ?? "",
                cover: data.cover ?? "",
                website: data.website ?? "",

                email: data.email ?? "",
                mapUrl: data.mapUrl ?? "",
                socials:
                    data.socials && typeof data.socials === "object" &&
                    !Array.isArray(data.socials)
                        ? data.socials
                        : {},
                gallery: Array.isArray(data.gallery)
                    ? data.gallery
                        .filter(
                            (photo) =>
                                photo &&
                                typeof photo.src === "string" &&
                                photo.src.startsWith("/media/orgs/")
                        )
                        .map((photo) => ({
                            src: photo.src,
                            alt: photo.alt || `Фотография: ${data.title}`,
                        }))
                    : [],

                status: data.status ?? "draft",
                content,
            };
        }
    }

    return null;
}

// Hybrid read: existing Markdown cards take precedence over new CMS cards.
export async function getAllOrgs() {
    const [legacy, cards] = await Promise.all([
        getAllMarkdownOrgs(),
        getPrisma().organization.findMany({ where: { status: "PUBLISHED" },
            include: { images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } }),
    ]);
    const reserved = new Set(legacy.map(item => item.slug));
    return [...legacy, ...cards.filter(item => !reserved.has(item.slug)).map(organizationToPublic)];
}

export async function getOrgBySlug(slug) {
    const legacy = await getMarkdownOrgBySlug(slug);
    if (legacy) return legacy;
    const card = await getPrisma().organization.findUnique({ where: { slug },
        include: { images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
    return card?.status === "PUBLISHED" ? organizationToPublic(card) : null;
}
