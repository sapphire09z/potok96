import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { cinemaPushkinVerified, publicCinemaTicketUrl } from "@/lib/cinemaTicketPolicy.mjs";
import TicketAdminPanel from "./TicketAdminPanel";
import styles from "./tickets-admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Билеты и Пушкинская карта — Поток 96", robots: { index: false, follow: false } };

export default async function CinemaTicketsAdminPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();
    const rows = await getPrisma().cinemaSession.findMany({
        where: { isCurrent: true, deleted: false, locked: false,
            startAt: { gt: new Date() }, movie: { isCurrent: true } },
        orderBy: [{ startAt: "asc" }, { externalId: "asc" }],
        take: 150,
        include: { movie: { select: { title: true } } },
    });
    const data = rows.map(item => ({
        id: item.externalId, movieTitle: item.movie.title,
        startAt: item.startAt.toISOString(), hallName: item.hallName,
        pushkinId: item.pushkinId || "", pushkinConfirmed: cinemaPushkinVerified(item),
        pushkinProofNote: cinemaPushkinVerified(item) ? item.pushkinProofNote ?? "" : "",
        ticketUrl: publicCinemaTicketUrl(item),
        needsReview: Boolean((item.ticketUrl && !publicCinemaTicketUrl(item)) ||
            (item.verifiedPushkinId && !cinemaPushkinVerified(item))),
        reviewedAt: item.listingReviewedAt?.toISOString() ?? null,
    }));
    return <main className={styles.page}>
        <Link href="/admin/cinema" className={styles.back}>← Синхронизация киноафиши</Link>
        <header className={styles.heading}>
            <h2>Билеты и Пушкинская карта</h2>
            <p>Только будущие активные сеансы. Каждая плашка и внешняя ссылка требуют отдельного подтверждения в ADMIN.</p>
        </header>
        <TicketAdminPanel initialItems={data} />
    </main>;
}
