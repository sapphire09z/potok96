import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { DOCUMENT_ID } from "@/lib/officialDocumentValidation.mjs";
import { publicDocumentPdfUrl } from "@/lib/media/officialDocumentPdf";
import OfficialDocumentForm from "../OfficialDocumentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редактирование нормативного документа — ADMIN", robots: { index: false, follow: false } };
export default async function EditOfficialDocumentPage({ params }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const { id } = await params;
    if (!DOCUMENT_ID.test(id)) notFound();
    const item = await getPrisma().officialDocument.findUnique({ where: { id } });
    if (!item) notFound();
    const initial = {
        id: item.id, slug: item.slug, title: item.title, type: item.type,
        number: item.number, date: item.date, issuer: item.issuer,
        description: item.description, sourceUrl: item.sourceUrl,
        status: item.status, hasPdf: Boolean(item.privatePdfKey),
        publicPdfUrl: item.status === "PUBLISHED" && item.publicPdfKey ? publicDocumentPdfUrl(item.publicPdfKey) : null,
        updatedAt: item.updatedAt.toISOString(),
    };
    return <OfficialDocumentForm key={`${item.id}:${initial.updatedAt}`} initial={initial} />;
}
