import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { NOTICE_ID } from "@/lib/officialNoticeValidation.mjs";
import OfficialNoticeForm from "../OfficialNoticeForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редактирование официального сообщения — ADMIN", robots: { index: false, follow: false } };
export default async function EditOfficialNoticePage({ params }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const { id } = await params;
    if (!NOTICE_ID.test(id)) notFound();
    const notice = await getPrisma().officialNotice.findUnique({ where: { id } });
    if (!notice) notFound();
    return <OfficialNoticeForm key={`${notice.id}:${notice.updatedAt.toISOString()}`} initial={{
        ...notice, updatedAt: notice.updatedAt.toISOString(),
        createdAt: notice.createdAt.toISOString(),
        publishedAt: notice.publishedAt?.toISOString() ?? null,
    }} />;
}
