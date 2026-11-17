import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { cinemaFilmPushkinCard } from "@/lib/cinemaTicketPolicy.mjs";
import TicketAdminPanel from "./TicketAdminPanel";
import styles from "./tickets-admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Билеты и Пушкинская карта — Поток 96", robots: { index: false, follow: false } };

export default async function CinemaTicketsAdminPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();
    const active = { isCurrent: true, deleted: false, locked: false, startAt: { gt: new Date() } };
    const rows = await getPrisma().cinemaMovie.findMany({
        where: { isCurrent: true, sessions: { some: active } },
        select: { externalId: true, title: true, pushkinId: true, ticketPageUrl: true,
            updatedAt: true, sessions: { where: active, orderBy: { startAt: "asc" }, take: 1,
                select: { startAt: true } } },
        orderBy: [{ title: "asc" }, { externalId: "asc" }], take: 150,
    });
    const items = rows.map(movie => ({
        id: movie.externalId, title: movie.title, pushkinId: movie.pushkinId ?? "",
        pushkinCard: cinemaFilmPushkinCard(movie), ticketPageUrl: movie.ticketPageUrl ?? "",
        updatedAt: movie.updatedAt.toISOString(),
        nearestScreening: movie.sessions[0]?.startAt.toISOString() ?? null,
    }));
    return <main className={styles.page}>
        <Link href="/admin/cinema" className={styles.back}>← Синхронизация киноафиши</Link>
        <header className={styles.heading}>
            <h2>Билеты и Пушкинская карта</h2>
            <p>Настройки задаются один раз на фильм. «Пушкинская карта» определяется по идентификатору фильма в данных Премьер Зала. Адрес покупки — проверенная страница фильма на kinokruf.ru; дата подставляется автоматически.</p>
        </header>
        <TicketAdminPanel initialItems={items} />
    </main>;
}
