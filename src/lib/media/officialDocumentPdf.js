import { randomUUID, createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getMediaS3, getPrivate, putPrivate, deletePrivate, deletePublic } from "@/lib/media/s3";
import { PDF_MAX_BYTES, isValidPdf } from "@/lib/officialDocumentValidation.mjs";

const PUBLIC_KEY = /^media\/documents\/published\/c[a-z0-9]{10,40}\/[a-f0-9-]{36}\.pdf$/;
const PRIVATE_KEY = /^media\/documents\/draft\/c[a-z0-9]{10,40}\/[a-f0-9-]{36}\.pdf$/;

export function privateDocumentPdfKey(id) { return `media/documents/draft/${id}/${randomUUID()}.pdf`; }
export function publishedDocumentPdfKey(id) { return `media/documents/published/${id}/${randomUUID()}.pdf`; }
export function publicDocumentPdfUrl(key) {
    const base = process.env.MEDIA_PUBLIC_BASE_URL;
    if (!PUBLIC_KEY.test(key ?? "") || !base || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(base))
        throw new Error("Invalid document PDF CDN configuration or key");
    return `${base.replace(/\/$/, "")}/${key}`;
}
export async function uploadPrivateDocumentPdf(key, bytes) {
    if (!PRIVATE_KEY.test(key) || !isValidPdf(bytes)) throw new Error("Invalid draft PDF");
    await putPrivate(key, bytes, "application/pdf");
}
export async function loadPrivateDocumentPdf(key) {
    if (!PRIVATE_KEY.test(key)) throw new Error("Invalid draft PDF key");
    const object = await getPrivate(key);
    if (object.ContentLength > PDF_MAX_BYTES || !object.Body) throw new Error("Invalid private PDF length");
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    if (!isValidPdf(bytes)) throw new Error("Invalid private PDF content");
    return bytes;
}
export async function publishDocumentPdf(key, bytes) {
    if (!PUBLIC_KEY.test(key) || !isValidPdf(bytes)) throw new Error("Invalid published PDF");
    const bucket = process.env.S3_PUBLIC_BUCKET;
    if (!bucket) throw new Error("S3_PUBLIC_BUCKET is not configured");
    publicDocumentPdfUrl(key);
    await getMediaS3().send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: bytes, ContentType: "application/pdf",
        ContentDisposition: "attachment; filename=official-document.pdf",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { sha256: createHash("sha256").update(bytes).digest("hex") },
    }));
}
export async function discardPrivateDocumentPdf(key) {
    if (key && PRIVATE_KEY.test(key)) await deletePrivate(key);
}
export async function discardPublishedDocumentPdf(key) {
    if (key && PUBLIC_KEY.test(key)) await deletePublic(key);
}
