import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";
import { eventToPublic } from "@/lib/eventAdmin.mjs";
import { eventImageUrl } from "@/lib/eventMedia";

function eventWithCover(row) {
    const result = eventToPublic(row);
    const selected = row.coverImageId && row.images?.find(img => img.id === row.coverImageId);
    return selected ? { ...result, cover: eventImageUrl(row.id, selected, 960) } : result;
}

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
                    category: data.category ?? "other",
                    startAt: data.startAt,
                    endAt: data.endAt ?? null,
                    location: data.location ?? "",
                    price: data.price ?? "",
                    isFree: data.isFree === true,
                    pushkinCard: data.pushkinCard === true,
                    summary: data.summary ?? "",
                    cover: data.cover ?? "",
                    org: data.org ?? null,
                    status: data.status ?? "draft",
                };
            })
    );

    // Preserve legacy priority, including draft slugs that must not be shadowed.
    const reserved = new Set(items.map(item => item.slug).filter(Boolean));
    const cards = await getPrisma().eventPost.findMany({ where: { status: "PUBLISHED" },
        include: { images: { select: { id: true, storageKey: true } } },
        orderBy: [{ startAt: "asc" }, { id: "asc" }] });
    return [...items.filter(e => e.status === "published"),
        ...cards.filter(item => !reserved.has(item.slug)).map(eventWithCover)]
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
                category: data.category ?? "other",
                startAt: data.startAt,
                endAt: data.endAt ?? null,
                location: data.location ?? "",
                price: data.price ?? "",
                isFree: data.isFree === true,
                pushkinCard: data.pushkinCard === true,
                summary: data.summary ?? "",
                cover: data.cover ?? "",
                video: data.video ?? "",
                org: data.org ?? null,
                status: data.status ?? "draft",
                content,
            };
        }
    }

    const card = await getPrisma().eventPost.findUnique({ where: { slug },
        include: { images: { select: { id: true, storageKey: true } } } });
    return card?.status === "PUBLISHED" ? eventWithCover(card) : null;
}
