import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const ADS_DIR = path.join(process.cwd(), "content", "ads");

function normalizeTags(tags) {
    if (Array.isArray(tags)) return tags;
    if (typeof tags === "string" && tags.trim()) return [tags];
    return [];
}

function normalizeAd(data, content = "") {
    return {
        slug: data.slug,
        title: data.title,
        date: data.date ?? "",
        category: data.category ?? "Объявление",
        price: data.price ?? "",
        location: data.location ?? "",
        contact: data.contact ?? "",
        summary: data.summary ?? "",
        status: data.status ?? "draft",
        tags: normalizeTags(data.tags),
        content,
    };
}

async function getAdFiles() {
    try {
        const files = await fs.readdir(ADS_DIR);
        return files.filter((file) => file.endsWith(".md"));
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
}

export async function getAllAds() {
    const files = await getAdFiles();

    const ads = await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(ADS_DIR, file);
            const raw = await fs.readFile(filePath, "utf8");
            const { data, content } = matter(raw);

            return normalizeAd(data, content);
        })
    );

    return ads.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function getAdBySlug(slug) {
    const ads = await getAllAds();

    return ads.find((ad) => ad.slug === slug) ?? null;
}