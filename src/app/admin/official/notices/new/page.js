import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import OfficialNoticeForm from "../OfficialNoticeForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новое официальное сообщение — ADMIN", robots: { index: false, follow: false } };
export default async function NewOfficialNoticePage() {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    return <OfficialNoticeForm initial={null} />;
}
