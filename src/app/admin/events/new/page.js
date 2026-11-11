import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import EventForm from "../EventForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новое мероприятие — Поток 96", robots: { index: false, follow: false } };

export default async function NewEventPage() {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    return <EventForm initial={null} />;
}
