import { authenticateDocumentRequest, documentReply } from "@/lib/officialDocumentApi";
import { officialDocumentSlugExists, readDocumentRequest } from "@/lib/officialDocumentCms";

export const runtime = "nodejs";
export async function POST(request) {
    const auth = await authenticateDocumentRequest(request);
    if (auth.response) return auth.response;
    const parsed = await readDocumentRequest(request);
    if (parsed.error) return documentReply({ error: parsed.error }, parsed.status);
    try {
        if (await officialDocumentSlugExists(parsed.data.slug))
            return documentReply({ error: "Адрес уже занят, в том числе старым Markdown-документом." }, 409);
        const row = await auth.db.officialDocument.create({
            data: { ...parsed.data, createdById: auth.actor.id },
            select: { id: true, updatedAt: true },
        });
        return documentReply({ success: true, id: row.id, updatedAt: row.updatedAt.toISOString() }, 201);
    } catch (error) {
        if (error?.code === "P2002") return documentReply({ error: "Адрес уже занят." }, 409);
        console.error("Official document create failed", { code: error?.code ?? "unknown" });
        return documentReply({ error: "Не удалось создать документ." }, 503);
    }
}
