import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();
    const prisma = getPrisma();
    const [users, posts, ads, latestRoles] = await Promise.all([
        prisma.user.groupBy({ by: ["role"], where: { archivedAt: null }, _count: { _all: true } }),
        prisma.newsPost.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.classifiedAd.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.adminRoleChange.findMany({ orderBy: { createdAt: "desc" }, take: 5,
            select: { id: true, actorId: true, targetId: true, oldRole: true, newRole: true, createdAt: true } }),
    ]);
    const roleCounts = Object.fromEntries(users.map((item) => [item.role, item._count._all]));
    const newsCounts = Object.fromEntries(posts.map((item) => [item.status, item._count._all]));
    const adsCounts = Object.fromEntries(ads.map((item) => [item.status, item._count._all]));
    const userTotal = users.reduce((sum, item) => sum + item._count._all, 0);
    const newsTotal = posts.reduce((sum, item) => sum + item._count._all, 0);
    const formatDate = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "short", timeStyle: "short" });

    return <main className={styles.content}>
        <div className={styles.sectionHeading}>
            <h2>Обзор проекта</h2>
            <p>Данные из PostgreSQL, обновляются при открытии страницы.</p>
        </div>
        <div className={styles.stats}>
            <Link href="/admin/users" className={styles.stat}>
                <span>Пользователей</span><strong>{userTotal}</strong>
                <small>ADMIN {roleCounts.ADMIN ?? 0} · MODERATOR {roleCounts.MODERATOR ?? 0} · USER {roleCounts.USER ?? 0}</small>
            </Link>
            <Link href="/editor/news" className={styles.stat}>
                <span>Новостей в CMS</span><strong>{newsTotal}</strong>
                <small>Опубликовано {newsCounts.PUBLISHED ?? 0} · На проверке {newsCounts.REVIEW ?? 0}</small>
            </Link>
            <Link href="/moderator/ads" className={styles.stat}>
                <span>Объявления на проверке</span><strong>{(adsCounts.PENDING ?? 0) + (adsCounts.APPROVED ?? 0)}</strong>
                <small>Опубликовано {adsCounts.PUBLISHED ?? 0}</small>
            </Link>
        </div>
        <section className={styles.panel}>
            <h2>Управление</h2>
            <div className={styles.links}>
                <Link href="/admin/users">Учётные записи и права доступа</Link>
                <Link href="/admin/orgs">Управление организациями</Link>
                <Link href="/admin/events">Управление мероприятиями</Link>
                <Link href="/editor/news">Создание, проверка и публикация новостей</Link>
                <Link href="/moderator/ads">Очередь модерации объявлений</Link>
            </div>
            <p className={styles.muted}>Киноафишу, официальные материалы и настройки портала добавим отдельными этапами.</p>
        </section>
        <section className={styles.panel}>
            <h2>Последние изменения ролей</h2>
            {latestRoles.length === 0 ? <p className={styles.muted}>Изменений через панель пока не было.</p> :
                <ol className={styles.history}>{latestRoles.map((item) => <li key={item.id}>
                    <time>{formatDate.format(item.createdAt)}</time>
                    <span>{item.oldRole} → <strong>{item.newRole}</strong></span>
                    <code title={item.targetId}>Пользователь {item.targetId.slice(0, 12)}…</code>
                </li>)}</ol>}
        </section>
    </main>;
}
