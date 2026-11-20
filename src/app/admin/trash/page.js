import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { earliestPurgeDate } from "@/lib/contentTrashPolicy.mjs";
import TrashPanel from "./TrashPanel";
import styles from "./trash.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Корзина материалов — Поток 96", robots: { index: false, follow: false } };
const PER_PAGE = 20;
const auditKindNames = { news: "Новость", events: "Мероприятие", orgs: "Организация", ads: "Объявление" };
const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short",
});
function url(kind, page = 1) {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (page > 1) params.set("page", String(page));
    return `/admin/trash${params.size ? `?${params}` : ""}`;
}

export default async function ContentTrashPage({ searchParams }) {
    const actor = await getCurrentUser();
    if (!actor) redirect("/login");
    if (actor.role !== "ADMIN") notFound();
    const db = getPrisma();
    const current = await db.user.findUnique({ where: { id: actor.id },
        select: { role: true, archivedAt: true } });
    if (current?.role !== "ADMIN" || current.archivedAt) notFound();
    const params = await searchParams;
    const kind = ["news", "events"].includes(params?.kind) ? params.kind : "all";
    const rawPage = Number(params?.page ?? 1);
    const requestedPage = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1;
    const [newsCount, eventCount, history] = await Promise.all([
        db.newsPost.count({ where: { status: "TRASHED" } }),
        db.eventPost.count({ where: { status: "TRASHED" } }),
        db.contentTrashAudit.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12 }),
    ]);
    const total = kind === "all" ? newsCount + eventCount : kind === "news" ? newsCount : eventCount;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const page = Math.min(requestedPage, pages);
    // Taking the top (page * PER_PAGE) from each type is sufficient to merge
    // the global top page; avoids loading the entire growing trash table.
    const limit = page * PER_PAGE;
    const [news, events] = await Promise.all([
        kind !== "events" ? db.newsPost.findMany({ where: { status: "TRASHED" },
            select: { id: true, slug: true, title: true, updatedAt: true, trashedAt: true, purgeStartedAt: true },
            orderBy: [{ trashedAt: "desc" }, { id: "desc" }], take: limit }) : [],
        kind !== "news" ? db.eventPost.findMany({ where: { status: "TRASHED" },
            select: { id: true, slug: true, title: true, updatedAt: true, trashedAt: true, purgeStartedAt: true },
            orderBy: [{ trashedAt: "desc" }, { id: "desc" }], take: limit }) : [],
    ]);
    const items = [
        ...news.map(x => ({ ...x, kind: "news" })),
        ...events.map(x => ({ ...x, kind: "events" })),
    ].sort((a, b) => b.trashedAt.getTime() - a.trashedAt.getTime() || b.id.localeCompare(a.id));
    const pageItems = items.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(x => ({
        id: x.id, kind: x.kind, title: x.title, slug: x.slug,
        updatedAt: x.updatedAt.toISOString(), trashedAt: x.trashedAt.toISOString(),
        deleting: Boolean(x.purgeStartedAt),
        eligibleAt: earliestPurgeDate(x.trashedAt).toISOString(),
    }));
    return <main className={styles.page}>
        <Link className={styles.back} href="/admin">← В ADMIN</Link>
        <header className={styles.heading}>
            <h1>Корзина материалов</h1>
            <p>Новости и обычные мероприятия. Восстановление возвращает материал в черновик, не публикуя его.
                Пока материал в корзине, его можно восстановить. Через 30 дней автоматического удаления нет.
                ADMIN может удалить материал навсегда вручную, без ожидания 30 дней.</p>
        </header>
        <nav className={styles.tabs} aria-label="Тип материала">
            {[["all", "Все", newsCount + eventCount], ["news", "Новости", newsCount],
                ["events", "Мероприятия", eventCount]].map(([id, title, count]) =>
                <Link key={id} className={kind === id ? styles.active : ""} href={url(id)}
                    aria-current={kind === id ? "page" : undefined}>{title} ({count})</Link>)}
        </nav>
        <p className={styles.meta}>В корзине по фильтру: {total}. Страница {page} из {pages}.</p>
        <TrashPanel items={pageItems} />
        {pages > 1 && <nav className={styles.pager} aria-label="Страницы корзины">
            {page > 1 ? <Link href={url(kind, page - 1)}>← Предыдущая</Link> : <span />}
            <span>{page} / {pages}</span>
            {page < pages ? <Link href={url(kind, page + 1)}>Следующая →</Link> : <span />}
        </nav>}
        <section className={styles.history}>
            <h2>Журнал действий</h2>
            {history.length === 0 ? <p className={styles.meta}>Операций пока не было.</p> :
                <ol>{history.map(log => <li key={log.id}>
                    <strong>{log.action === "trash" ? "В корзину" : log.action === "restore" ? "Восстановлено" : "Удалено навсегда"}</strong>
                    {" · "}{auditKindNames[log.kind] || log.kind}
                    {" · "}{log.title} · {formatted.format(log.createdAt)} ·
                    ID администратора: {log.actorId}{log.reason && ` · Причина: ${log.reason}`}
                </li>)}</ol>}
        </section>
    </main>;
}
