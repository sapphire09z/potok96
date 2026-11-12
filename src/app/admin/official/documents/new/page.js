import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import OfficialDocumentForm from "../OfficialDocumentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новый нормативный документ — ADMIN", robots: { index: false, follow: false } };
export default async function NewOfficialDocumentPage() {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    return <OfficialDocumentForm initial={null} />;
}
