import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";
import { publicNewsBody, publicNewsCover } from "@/lib/newsMedia";

const NEWS_DIR = path.join(process.cwd(), "content", "news");
function normalizeTags(tags) {
    if (Array.isArray(tags)) return tags;
    if (typeof tags === "string" && tags.trim()) return [tags];
    return [];
}

async function readMarkdownNews() {
    const files = await fs.readdir(NEWS_DIR);
    return Promise.all(files.filter((name) => name.endsWith(".md")).map(async (name) => {
        const raw = await fs.readFile(path.join(NEWS_DIR, name), "utf8");
        const { data, content } = matter(raw);
        return {
            category: data.category ?? "город",
            crosspost: data.crosspost ?? [],
            slug: data.slug,
            title: data.title,
            date: data.date,
            summary: data.summary ?? "",
            status: data.status ?? "draft",
            author: data.author ?? "Редакция Поток 96",
            org: data.org ?? "",
            tags: normalizeTags(data.tags),
            cover: data.cover ?? "",
            featured: data.featured === true,
            featuredOrder: Number(data.featuredOrder ?? 99),
            sourceName: data.sourceName ?? "",
            sourceUrl: data.sourceUrl ?? "",
            photoCredits: [],
            content,
        };
    }));
}

const summarySelect = {
    id: true,
    slug: true, title: true, category: true, summary: true, tags: true,
    publishedAt: true, authorName: true, orgSlug: true, crosspost: true,
    featured: true, featuredOrder: true, cover: true, coverImageId: true,
    images: { select: { id: true, storageKey: true } },
};

function toPublicSummary(post) {
    return {
        category: post.category, crosspost: post.crosspost, slug: post.slug,
        title: post.title, date: post.publishedAt.toISOString(),
        summary: post.summary, status: "published", author: post.authorName,
        org: post.orgSlug || "", tags: post.tags,
        cover: publicNewsCover(post), featured: post.featured,
        featuredOrder: post.featuredOrder, editorialPriority: 0,
    };
}

// All public feeds use this function: homepage, /news, categories and sitemap.
// APPROVED, REVIEW, DRAFT and UNPUBLISHED records never leave the database here.
export async function getAllNews() {
    const [files, posts] = await Promise.all([
        readMarkdownNews(),
        getPrisma().newsPost.findMany({
            where: { status: "PUBLISHED", publishedAt: { not: null } },
            select: summarySelect,
        }),
    ]);
    const publishedMarkdown = files.filter((post) => post.status === "published");
    const reservedSlugs = new Set(publishedMarkdown.map((post) => post.slug));
    const publishedDb = posts.filter((post) => !reservedSlugs.has(post.slug))
        .map(toPublicSummary);
    return [...publishedMarkdown.map(({ content, ...summary }) => summary), ...publishedDb]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getNewsBySlug(slug) {
    const files = await readMarkdownNews();
    const markdown = files.find((post) => post.slug === slug && post.status === "published");
    if (markdown) return markdown;

    const post = await getPrisma().newsPost.findUnique({
        where: { slug },
        select: {
            ...summarySelect, body: true, status: true,
            sourceName: true, sourceUrl: true,
            images: { select: { id: true, storageKey: true, credit: true } },
        },
    });
    if (!post || post.status !== "PUBLISHED" || !post.publishedAt) return null;
    const photoCredits = [...new Set(post.images.map((image) => image.credit?.trim()).filter(Boolean))];
    return {
        ...toPublicSummary(post),
        content: publicNewsBody(post),
        sourceName: post.sourceName || "",
        sourceUrl: post.sourceUrl || "",
        photoCredits,
    };
}

// Explicitly chosen CMS stories come first; legacy Markdown featured stories
// remain eligible, but never outrank a newly promoted CMS article.
export function getFeaturedNews(news) {
    return news.filter((post) => post.status === "published" && post.featured)
        .sort((a, b) => (a.editorialPriority ?? 1) - (b.editorialPriority ?? 1) ||
            (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99) ||
            new Date(b.date).getTime() - new Date(a.date).getTime() ||
            a.slug.localeCompare(b.slug))
        .slice(0, 3);
}
