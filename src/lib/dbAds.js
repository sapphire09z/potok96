
import { getPrisma } from "./prisma";

const publishedFields = {
    slug: true,
    title: true,
    category: true,
    description: true,
    priceRub: true,
    location: true,
    contactPhone: true,
    publishedAt: true,
};

function publishedWhere(now) {
    return {
        status: "PUBLISHED",
        slug: { not: null },
        publishedAt: { lte: now },
        OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
        ],
    };
}

function normalizeDbAd(ad) {
    return {
        slug: ad.slug,
        title: ad.title,
        category: ad.category,
        date: ad.publishedAt.toISOString().slice(0, 10),
        price:
            ad.priceRub === null
                ? ""
                : `${new Intl.NumberFormat("ru-RU").format(ad.priceRub)} ₽`,
        location: ad.location,
        contact: ad.contactPhone,
        summary: ad.description.slice(0, 160),
        status: "published",
        tags: [],
        photos: [],
        content: ad.description,
    };
}

export async function getPublishedDbAds() {
    const ads = await getPrisma().classifiedAd.findMany({
        where: publishedWhere(new Date()),
        select: publishedFields,
        orderBy: { publishedAt: "desc" },
        take: 100,
    });

    return ads.map(normalizeDbAd);
}

export async function getPublishedDbAdBySlug(slug) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return null;
    }

    const ad = await getPrisma().classifiedAd.findFirst({
        where: {
            ...publishedWhere(new Date()),
            slug,
        },
        select: publishedFields,
    });

    return ad ? normalizeDbAd(ad) : null;
}
