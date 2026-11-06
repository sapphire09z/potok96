import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isNewsEditor } from "@/lib/newsDraft";
import NewsDraftForm from "../NewsDraftForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая новость — Редакция", robots: { index: false, follow: false } };

export default async function NewNewsPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!isNewsEditor(user)) notFound();

    return <NewsDraftForm />;
}
