import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import OrganizationForm from "../OrganizationForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редактирование организации — Управление", robots: { index: false, follow: false } };
export default async function EditOrganizationPage({ params }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const { id } = await params;
    if (!/^c[a-z0-9]{10,40}$/.test(id)) notFound();
    const item = await getPrisma().organization.findUnique({ where: { id },
        include: { images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
    if (!item) notFound();
    return <OrganizationForm key={`${item.id}:${item.updatedAt.toISOString()}`} initial={{
        ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
        publishedAt: item.publishedAt?.toISOString() || null,
    }} />;
}
