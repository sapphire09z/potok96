import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { isOfficialAdmin } from "@/lib/officialNoticeCms";
import { ALERT_ID } from "@/lib/serviceAlertValidation.mjs";
import AlertForm from "../AlertForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редактирование уведомления — ADMIN", robots: { index: false, follow: false } };
export default async function EditAlertPage({ params }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, me))) notFound();
    const { id } = await params;
    if (!ALERT_ID.test(id)) notFound();
    const item = await db.serviceAlert.findUnique({ where: { id } });
    if (!item) notFound();
    return <AlertForm key={`${item.id}:${item.updatedAt.toISOString()}`} initial={{
        ...item, startAt: item.startAt.toISOString(),
        expectedEndAt: item.expectedEndAt?.toISOString() ?? null,
        restoredAt: item.restoredAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(), createdAt: item.createdAt.toISOString(),
        publishedAt: item.publishedAt?.toISOString() ?? null,
    }} />;
}
