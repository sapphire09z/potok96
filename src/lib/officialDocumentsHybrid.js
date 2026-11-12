import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "@/lib/prisma";
import { getAllOfficialDocuments } from "@/lib/officialDocuments";
import { publicDocumentPdfUrl } from "@/lib/media/officialDocumentPdf";

const ROOT = path.join(process.cwd(), "content", "official", "documents");

export async function getAllOfficialDocumentsHybrid() {
    const legacy = getAllOfficialDocuments();
    const reserved = new Set(fs.existsSync(ROOT) ? fs.readdirSync(ROOT)
        .filter(f => f.endsWith(".md")).map(f => path.basename(f, ".md")) : []);
    const records = await getPrisma().officialDocument.findMany({
        where: { status: "PUBLISHED", publicPdfKey: { not: null } },
        select: { slug: true, title: true, type: true, number: true, date: true,
            issuer: true, sourceUrl: true, description: true, publicPdfKey: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    const cms = records.filter(row => !reserved.has(row.slug)).map(row => ({
        ...row, fileUrl: publicDocumentPdfUrl(row.publicPdfKey), status: "published",
    }));
    return [...legacy, ...cms].sort((a, b) =>
        b.date.localeCompare(a.date) || b.number.localeCompare(a.number, "ru"));
}
