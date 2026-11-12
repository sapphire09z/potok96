import { revalidatePath } from "next/cache";
import { authenticateDocumentRequest, documentReply, nextDocumentVersion } from "@/lib/officialDocumentApi";
import { validDocumentVersion } from "@/lib/officialDocumentValidation.mjs";
import { officialDocumentSlugExists } from "@/lib/officialDocumentCms";
import { loadPrivateDocumentPdf, publishedDocumentPdfKey, publishDocumentPdf,
    discardPublishedDocumentPdf, publicDocumentPdfUrl } from "@/lib/media/officialDocumentPdf";

export const runtime = "nodejs";
export async function POST(request, { params }) {
    const { id } = await params;
    const auth = await authenticateDocumentRequest(request, id);
    if (auth.response) return auth.response;
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return documentReply({ error: "Ожидается JSON." }, 415);
    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 500) return documentReply({ error: "Слишком большой запрос." }, 413);
        body = JSON.parse(raw);
    } catch { return documentReply({ error: "Некорректный JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 2 ||
        !Object.hasOwn(body, "action") || !Object.hasOwn(body, "expectedUpdatedAt") ||
        !["publish", "unpublish"].includes(body.action) || !validDocumentVersion(body.expectedUpdatedAt))
        return documentReply({ error: "Некорректное изменение статуса." }, 400);

    const from = body.action === "publish" ? "DRAFT" : "PUBLISHED";
    const to = body.action === "publish" ? "PUBLISHED" : "DRAFT";
    let stagedPublicKey;
    let committed = false;
    try {
        const existing = await auth.db.officialDocument.findUnique({ where: { id },
            select: { slug: true, title: true, type: true, date: true, issuer: true, status: true,
                privatePdfKey: true, publicPdfKey: true, publishedAt: true, updatedAt: true },
        });
        if (!existing) return documentReply({ error: "Документ не найден." }, 404);
        if (existing.status !== from || existing.updatedAt.toISOString() !== body.expectedUpdatedAt)
            return documentReply({ error: "Данные изменились. Обновите страницу." }, 409);
        if (to === "PUBLISHED") {
            if (!existing.privatePdfKey || !existing.title.trim() || !existing.type.trim() ||
                !existing.issuer.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(existing.date))
                return documentReply({ error: "Для публикации заполните реквизиты и загрузите PDF." }, 422);
            if (await officialDocumentSlugExists(existing.slug, id))
                return documentReply({ error: "Адрес занят старым Markdown-документом." }, 409);
            const bytes = await loadPrivateDocumentPdf(existing.privatePdfKey);
            stagedPublicKey = publishedDocumentPdfKey(id);
            await publishDocumentPdf(stagedPublicKey, bytes);
        }
        const updatedAt = nextDocumentVersion(body.expectedUpdatedAt);
        const changed = await auth.db.officialDocument.updateMany({
            where: { id, status: from, updatedAt: new Date(body.expectedUpdatedAt) },
            data: { status: to, publicPdfKey: to === "PUBLISHED" ? stagedPublicKey : null,
                updatedAt, ...(to === "PUBLISHED" ? { publishedAt: existing.publishedAt ?? new Date() } : {}) },
        });
        if (changed.count !== 1) {
            if (stagedPublicKey) await discardPublishedDocumentPdf(stagedPublicKey).catch(() => {});
            return documentReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        }
        committed = true;
        try { revalidatePath("/official/documents"); }
        catch (error) { console.error("Document revalidation failed", { code: error?.code ?? "unknown" }); }
        return documentReply({ success: true, status: to, updatedAt: updatedAt.toISOString(),
            publicPdfUrl: to === "PUBLISHED" ? publicDocumentPdfUrl(stagedPublicKey) : null });
    } catch (error) {
        if (stagedPublicKey && !committed) await discardPublishedDocumentPdf(stagedPublicKey).catch(() => {});
        if (error?.code === "P2034") return documentReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        console.error("Official document publication failed", { code: error?.code ?? "unknown" });
        return documentReply({ error: "Не удалось изменить статус публикации." }, 503);
    }
}
