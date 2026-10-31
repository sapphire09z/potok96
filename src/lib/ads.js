import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import {
    getPublishedDbAds,
    getPublishedDbAdBySlug,
} from "./dbAds";

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
        photos: normalizePhotos(data.photos),
        content,
    };
}

function normalizePhotos(photos) {
    if (!Array.isArray(photos)) return [];

    const validPhotos = photos.filter(
        (photo) =>
            typeof photo === "string" &&
            /^\/media\/ads\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(photo)
    );

    return [...new Set(validPhotos)].slice(0, 8);
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

async function getMarkdownAds() {
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


function getAdsSource() {
    return process.env.ADS_SOURCE ??
        (process.env.NODE_ENV === "production"
            ? "postgres"
            : "markdown");
}

export async function getAllAds() {
    const source = getAdsSource();

    if (source === "markdown") {
        return getMarkdownAds();
    }

    if (source === "postgres") {
        return getPublishedDbAds();
    }

    if (source !== "hybrid") {
        throw new Error("Invalid ADS_SOURCE configuration");
    }

    const [markdownAds, databaseAds] = await Promise.all([
        getMarkdownAds(),
        getPublishedDbAds(),
    ]);

    const bySlug = new Map(
        markdownAds.map((ad) => [ad.slug, ad])
    );

    for (const ad of databaseAds) {
        bySlug.set(ad.slug, ad);
    }

    return [...bySlug.values()].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    );
}

export async function getAdBySlug(slug) {
    const source = getAdsSource();

    if (source !== "markdown") {
        const ad = await getPublishedDbAdBySlug(slug);

        if (ad) return ad;
        if (source === "postgres") return null;
    }

    const markdownAds = await getMarkdownAds();

    return markdownAds.find((ad) => ad.slug === slug) ?? null;
}
