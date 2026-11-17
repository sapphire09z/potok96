import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import CinemaSyncPanel from "./CinemaSyncPanel";
import styles from "./cinema-admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Синхронизация киноафиши — Поток 96", robots: { index: false, follow: false } };

export default async function CinemaAdminPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();
    const db = getPrisma();
    const [movies, sessions, posters, runs] = await Promise.all([
        db.cinemaMovie.count({ where: { isCurrent: true } }),
        db.cinemaSession.count({ where: { isCurrent: true, deleted: false, locked: false, startAt: { gte: new Date() } } }),
        db.cinemaMovie.count({ where: { isCurrent: true, posterKey: { not: null } } }),
        db.cinemaSyncRun.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    ]);
    const safeRuns = runs.map(run => ({
        id: run.id, trigger: run.trigger, status: run.status,
        createdAt: run.createdAt.toISOString(),
        startedAt: run.startedAt?.toISOString() ?? null,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        movieCount: run.movieCount, sessionCount: run.sessionCount,
        posterCandidates: run.posterCandidates, posterUpdated: run.posterUpdated,
        posterUnchanged: run.posterUnchanged, posterSkipped: run.posterSkipped,
        posterFailures: run.posterFailures, posterFullScan: run.posterFullScan,
        error: run.error,
    }));
    return <main className={styles.page}>
        <header className={styles.heading}>
            <p className={styles.kicker}>ADMIN / АФИША</p>
            <h2>Синхронизация кинотеатра</h2>
            <p>Расписание из CinemaWebApi. Автоматическое обновление каждые 15 минут; проверка уже загруженных постеров каждые 6 часов.</p>
        </header>
        <div className={styles.stats}>
            <div><small>Фильмов</small><strong>{movies}</strong></div>
            <div><small>Будущих сеансов</small><strong>{sessions}</strong></div>
            <div><small>С постерами</small><strong>{posters}</strong></div>
        </div>
        <CinemaSyncPanel initialRuns={safeRuns} />
        <p className={styles.hint}>Обновление выполняет отдельный служебный процесс. Кнопка ставит задачу в очередь; не перезагружайте страницу для ожидания результата.</p>
    </main>;
}
