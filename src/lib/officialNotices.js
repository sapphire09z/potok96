import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getPrisma } from "@/lib/prisma";

const noticesDir = path.join(process.cwd(), "content", "official", "notices");

function readLegacyNotices() {
    if (!fs.existsSync(noticesDir)) return { notices: [], reserved: new Set() };
    const files = fs.readdirSync(noticesDir).filter(f => f.endsWith(".md"));
    const reserved = new Set(files.map(f => path.basename(f, ".md")));
    const notices = files.map(file => {
        const raw = fs.readFileSync(path.join(noticesDir, file), "utf8");
        const { data, content } = matter(raw);
        const date = data.date instanceof Date
            ? data.date.toISOString().slice(0, 10) : String(data.date ?? "");
        return {
            slug: path.basename(file, ".md"), title: String(data.title ?? ""),
            date, issuer: String(data.issuer ?? ""), summary: String(data.summary ?? ""),
            sourceUrl: String(data.sourceUrl ?? ""), locality: String(data.locality ?? ""),
            status: String(data.status ?? "draft"), content: content.trim(),
        };
    }).filter(item => item.status === "published" && item.title &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date));
    return { notices, reserved };
}

// Legacy Markdown remains read-only and takes priority even if it is a draft;
// CMS slugs are checked against ALL Markdown filenames during create/publish.
export async function getAllOfficialNotices() {
    const { notices: legacy, reserved } = readLegacyNotices();
    const rows = await getPrisma().officialNotice.findMany({ where: { status: "PUBLISHED" },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        select: { slug: true, title: true, date: true, issuer: true, summary: true,
            sourceUrl: true, locality: true, content: true },
    });
    const fresh = rows.filter(row => !reserved.has(row.slug)).map(row => ({
        ...row, status: "published",
    }));
    return [...legacy, ...fresh].sort((a, b) =>
        b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug, "ru"));
}

export async function getOfficialNoticeBySlug(slug) {
    return (await getAllOfficialNotices()).find(item => item.slug === slug) ?? null;
}
