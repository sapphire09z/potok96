
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const documentsDir = path.join(
    process.cwd(),
    "content",
    "official",
    "documents"
);

export function getAllOfficialDocuments() {
    if (!fs.existsSync(documentsDir)) {
        return [];
    }

    const files = fs
        .readdirSync(documentsDir)
        .filter((file) => file.endsWith(".md"));

    return files
        .map((file) => {
            const fullPath = path.join(documentsDir, file);
            const raw = fs.readFileSync(fullPath, "utf8");
            const { data } = matter(raw);

            return {
                slug: path.basename(file, ".md"),
                title: String(data.title ?? ""),
                type: String(data.type ?? ""),
                number: String(data.number ?? ""),
                date: String(data.date ?? ""),
                issuer: String(data.issuer ?? ""),
                sourceUrl: String(data.sourceUrl ?? ""),
                fileUrl: String(data.fileUrl ?? ""),
                status: String(data.status ?? "draft"),
            };
        })
        .filter((doc) =>
            doc.status === "published" &&
            doc.title &&
            doc.date &&
            /^\d{4}-\d{2}-\d{2}$/.test(doc.date)
        )
        .sort((a, b) =>
            b.date.localeCompare(a.date) ||
            b.number.localeCompare(a.number, "ru")
        );
}
