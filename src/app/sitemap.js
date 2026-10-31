
import { getAllNews } from "@/lib/news";
import { getAllEvents } from "@/lib/events";
import { getAllOrgs } from "@/lib/orgs";
import { getAllAds } from "@/lib/ads";
// Generate sitemap at request time, not during Docker build
export const dynamic = "force-dynamic";

const BASE_URL = "https://potok96.ru";

function validDate(value) {
    if (!value) return undefined;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap() {
    const [news, events, orgs, ads] = await Promise.all([
        getAllNews(),
        getAllEvents(),
        getAllOrgs(),
        getAllAds(),
    ]);

    const staticPages = [
        "",
        "/news",
        "/events",
        "/orgs",
        "/ads",
        "/about",
    ].map((path) => ({
        url: `${BASE_URL}${path}`,
        changeFrequency: "weekly",
        priority: path === "" ? 1 : 0.8,
    }));

    const publishedNews = news.filter(
        (post) => post.status === "published"
    );

    const newsPages = publishedNews.map((post) => ({
        url: `${BASE_URL}/news/${encodeURIComponent(post.slug)}`,
        lastModified: validDate(post.date),
        changeFrequency: "weekly",
        priority: 0.7,
    }));

    const categories = [
        ...new Set(publishedNews.map((post) => post.category).filter(Boolean)),
    ];

    const categoryPages = categories.map((category) => ({
        url: `${BASE_URL}/news/category/${encodeURIComponent(category)}`,
        changeFrequency: "weekly",
        priority: 0.6,
    }));

    const eventPages = events
        .filter((event) => event.status === "published")
        .map((event) => ({
            url: `${BASE_URL}/events/${encodeURIComponent(event.slug)}`,
            changeFrequency: "weekly",
            priority: 0.7,
        }));

    const orgPages = orgs
        .filter((org) => org.status === "published")
        .map((org) => ({
            url: `${BASE_URL}/orgs/${encodeURIComponent(org.slug)}`,
            changeFrequency: "monthly",
            priority: 0.7,
        }));

    const adPages = ads
        .filter((ad) => ad.status === "published")
        .map((ad) => ({
            url: `${BASE_URL}/ads/${encodeURIComponent(ad.slug)}`,
            lastModified: validDate(ad.date),
            changeFrequency: "weekly",
            priority: 0.5,
        }));

    return [
        ...staticPages,
        ...newsPages,
        ...categoryPages,
        ...eventPages,
        ...orgPages,
        ...adPages,
    ];
}
