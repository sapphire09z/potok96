import { authenticateDocumentRequest, documentReply, documentVersionHeader, nextDocumentVersion } from "@/lib/officialDocumentApi";
import { PDF_MAX_BYTES, isValidPdf, validPdfUploadFile } from "@/lib/officialDocumentValidation.mjs";
import { privateDocumentPdfKey, uploadPrivateDocumentPdf, discardPrivateDocumentPdf,
    loadPrivateDocumentPdf } from "@/lib/media/officialDocumentPdf";
import { draftPdfPreviewHeaders } from "@/lib/media/officialDocumentPreviewHeaders.mjs";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { isOfficialAdmin } from "@/lib/officialDocumentCms";
import { DOCUMENT_ID } from "@/lib/officialDocumentValidation.mjs";

export const runtime = "nodejs";
export async function POST(request, { params }) {
    const { id } = await params;
    const auth = await authenticateDocumentRequest(request, id);
    if (auth.response) return auth.response;
    const version = documentVersionHeader(request);
    if (!version) return documentReply({ error: "Обновите страницу перед загрузкой." }, 400);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
        return documentReply({ error: "Ожидается файл PDF." }, 415);
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > PDF_MAX_BYTES + 1024 * 1024)
        return documentReply({ error: "PDF не должен превышать 15 МБ." }, 413);
    let file;
    try {
        const body = await request.formData();
        if ([...body.keys()].length !== 1 || !body.has("file"))
            return documentReply({ error: "Загрузите один PDF." }, 400);
        file = body.get("file");
    } catch { return documentReply({ error: "Не удалось прочитать файл." }, 400); }
    if (!validPdfUploadFile(file)) return documentReply({ error: "Нужен PDF размером до 15 МБ." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!isValidPdf(bytes)) return documentReply({ error: "Файл не похож на корректный PDF." }, 400);
    let key;
    try {
        const old = await auth.db.officialDocument.findUnique({
            where: { id }, select: { status: true, privatePdfKey: true, updatedAt: true },
        });
        if (!old) return documentReply({ error: "Документ не найден." }, 404);
        if (old.status !== "DRAFT") return documentReply({ error: "Для замены PDF сначала снимите документ с публикации." }, 409);
        if (old.updatedAt.toISOString() !== version)
            return documentReply({ error: "Документ изменился. Обновите страницу." }, 409);
        key = privateDocumentPdfKey(id);
        await uploadPrivateDocumentPdf(key, bytes);
        const updatedAt = nextDocumentVersion(version);
        const changed = await auth.db.officialDocument.updateMany({
            where: { id, status: "DRAFT", updatedAt: new Date(version) },
            data: { privatePdfKey: key, publicPdfKey: null, updatedAt },
        });
        if (changed.count !== 1) {
            await discardPrivateDocumentPdf(key).catch(() => {});
            return documentReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        }
        if (old.privatePdfKey && old.privatePdfKey !== key)
            await discardPrivateDocumentPdf(old.privatePdfKey).catch(error =>
                console.error("Old document draft cleanup failed", { code: error?.code ?? "unknown" }));
        return documentReply({ success: true, updatedAt: updatedAt.toISOString(), hasPdf: true });
    } catch (error) {
        if (key) await discardPrivateDocumentPdf(key).catch(() => {});
        console.error("Official document PDF upload failed", { code: error?.code ?? "unknown" });
        return documentReply({ error: "Не удалось загрузить PDF." }, 503);
    }
}

// Viewing draft PDFs is a read-only, administrator-only operation. Top-level
// browser navigation does not send Origin, so do not use the write-only
// authenticateDocumentRequest helper (which deliberately requires Origin).
export async function GET(_request, { params }) {
    const actor = await getCurrentUser();
    if (!actor) return documentReply({ error: "Войдите в аккаунт." }, 401);
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, actor)))
        return documentReply({ error: "Доступ запрещён." }, 403);
    const { id } = await params;
    if (!DOCUMENT_ID.test(id)) return documentReply({ error: "Документ не найден." }, 404);
    try {
        const item = await db.officialDocument.findUnique({
            where: { id }, select: { status: true, privatePdfKey: true },
        });
        if (!item || item.status !== "DRAFT" || !item.privatePdfKey)
            return documentReply({ error: "Черновик PDF не найден." }, 404);
        const bytes = await loadPrivateDocumentPdf(item.privatePdfKey);
        return new Response(bytes, { status: 200, headers: draftPdfPreviewHeaders(bytes.length) });
    } catch (error) {
        console.error("Official document draft preview failed", { code: error?.code ?? "unknown" });
        return documentReply({ error: "Не удалось открыть PDF." }, 503);
    }
}
