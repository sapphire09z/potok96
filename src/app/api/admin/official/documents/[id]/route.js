import { authenticateDocumentRequest, documentReply, documentVersionHeader, nextDocumentVersion } from "@/lib/officialDocumentApi";
import { officialDocumentSlugExists, readDocumentRequest } from "@/lib/officialDocumentCms";

export const runtime = "nodejs";
export async function PATCH(request, { params }) {
    const { id } = await params;
    const auth = await authenticateDocumentRequest(request, id);
    if (auth.response) return auth.response;
    const version = documentVersionHeader(request);
    if (!version) return documentReply({ error: "Обновите страницу перед сохранением." }, 400);
    const parsed = await readDocumentRequest(request);
    if (parsed.error) return documentReply({ error: parsed.error }, parsed.status);
    try {
        const existing = await auth.db.officialDocument.findUnique({
            where: { id }, select: { slug: true, status: true },
        });
        if (!existing) return documentReply({ error: "Документ не найден." }, 404);
        if (existing.status === "PUBLISHED" && existing.slug !== parsed.data.slug)
            return documentReply({ error: "Адрес опубликованного документа изменять нельзя." }, 409);
        if (existing.slug !== parsed.data.slug && await officialDocumentSlugExists(parsed.data.slug, id))
            return documentReply({ error: "Этот адрес уже занят." }, 409);
        const updatedAt = nextDocumentVersion(version);
        const changed = await auth.db.officialDocument.updateMany({
            where: { id, status: existing.status, updatedAt: new Date(version) },
            data: { ...parsed.data, updatedAt },
        });
        if (changed.count !== 1) return documentReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        return documentReply({ success: true, updatedAt: updatedAt.toISOString() });
    } catch (error) {
        if (["P2002", "P2034"].includes(error?.code))
            return documentReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        console.error("Official document update failed", { code: error?.code ?? "unknown" });
        return documentReply({ error: "Не удалось сохранить документ." }, 503);
    }
}
