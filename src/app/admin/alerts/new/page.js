import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { isOfficialAdmin } from "@/lib/officialNoticeCms";
import AlertForm from "../AlertForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новое уведомление — ADMIN", robots: { index: false, follow: false } };
export default async function NewAlertPage() {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (!(await isOfficialAdmin(getPrisma(), me))) notFound();
    return <AlertForm initial={null} />;
}
