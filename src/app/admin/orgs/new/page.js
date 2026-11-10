import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import OrganizationForm from "../OrganizationForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая организация — Управление", robots: { index: false, follow: false } };
export default async function NewOrganizationPage() {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    return <OrganizationForm initial={null} />;
}
