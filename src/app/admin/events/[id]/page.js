import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { EVENT_ID, toEventLocalTime } from "@/lib/eventAdmin.mjs";
import EventForm from "../EventForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редактирование мероприятия — Поток 96", robots: { index: false, follow: false } };

export default async function EditEventPage({ params }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const { id } = await params;
    if (!EVENT_ID.test(id)) notFound();
    const event = await getPrisma().eventPost.findUnique({ where: { id } });
    if (!event) notFound();
    return <EventForm key={`${event.id}:${event.updatedAt.toISOString()}`} initial={{
        ...event, startAt: toEventLocalTime(event.startAt),
        endAt: toEventLocalTime(event.endAt), updatedAt: event.updatedAt.toISOString(),
        publishedAt: event.publishedAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
    }} />;
}
