import { getPrisma } from "./prisma";
import { publicAdPhotoVariant } from "./media/publishAds";

const publishedFields = {
  slug: true,
  title: true,
  category: true,
  description: true,
  priceRub: true,
  location: true,
  contactPhone: true,
  publishedAt: true,
  photos: {
    select: { storageKey: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  },
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
  const photoVariants = ad.photos.map(({ storageKey }) => ({
    src320: publicAdPhotoVariant(storageKey, 320),
    src640: publicAdPhotoVariant(storageKey, 640),
    src960: publicAdPhotoVariant(storageKey, 960),
    src1440: publicAdPhotoVariant(storageKey, 1440),
  }));

  return {
    slug: ad.slug,
    title: ad.title,
    category: ad.category,
    date: ad.publishedAt.toISOString().slice(0, 10),
    price: ad.priceRub === null ? "" :
      `${new Intl.NumberFormat("ru-RU").format(ad.priceRub)} ₽`,
    location: ad.location,
    contact: ad.contactPhone,
    summary: ad.description.slice(0, 160),
    status: "published",
    tags: [],
    photos: photoVariants.map((variant) => variant.src960),
    photoVariants,
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
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const ad = await getPrisma().classifiedAd.findFirst({
    where: { ...publishedWhere(new Date()), slug },
    select: publishedFields,
  });
  return ad ? normalizeDbAd(ad) : null;
}
