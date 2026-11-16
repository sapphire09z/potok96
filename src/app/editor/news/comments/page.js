import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { commentAuthorLabel } from "@/lib/newsComments.mjs";
import ModerationActions from "./ModerationActions";
import styles from "./comments-editor.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Модерация комментариев — Поток 96", robots: { index: false, follow: false } };
const PER_PAGE = 20;
const labels = { PENDING: "Ожидает проверки", APPROVED: "Опубликован", REJECTED: "Отклонён", HIDDEN: "Скрыт", DELETED: "Удалён автором" };
const filters = [
    { id: "pending", label: "На проверке" }, { id: "reported", label: "С жалобами" },
    { id: "hidden", label: "Скрытые" }, { id: "rejected", label: "Отклонённые" },
    { id: "all", label: "Все" },
];
const formatDate = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });

export default async function NewsCommentModerationPage({ searchParams }) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!["ADMIN", "MODERATOR"].includes(user.role)) notFound();
    const params = await searchParams;
    const filter = filters.some(item => item.id === params?.filter) ? params.filter : "pending";
    const pageValue = Number(params?.page || 1);
    const page = Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 10000 ? pageValue : 1;
    const conditions = {
        pending: { status: "PENDING" },
        reported: { status: "APPROVED", reports: { some: {} } },
        hidden: { status: "HIDDEN" },
        rejected: { status: "REJECTED" },
        all: { status: { not: "DELETED" } },
    };
    const where = conditions[filter];
    const prisma = getPrisma();
    const [total, items, pendingCount, reportedCount] = await Promise.all([
        prisma.newsComment.count({ where }),
        prisma.newsComment.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * PER_PAGE, take: PER_PAGE,
            select: { id: true, body: true, status: true, updatedAt: true, createdAt: true, parentId: true,
                post: { select: { id: true, title: true, slug: true, status: true, publishedAt: true } },
                author: { select: { displayName: true } },
                reports: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, reason: true } },
                _count: { select: { reports: true } },
                events: { orderBy: { createdAt: "desc" }, take: 3,
                    select: { id: true, action: true, note: true, createdAt: true } },
            } }),
        prisma.newsComment.count({ where: { status: "PENDING" } }),
        prisma.newsComment.count({ where: conditions.reported }),
    ]);
    const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
    const link = (f, p = 1) => `/editor/news/comments?filter=${f}&page=${p}`;
    return <main className={styles.page}>
        <nav className={styles.breadcrumb}><Link href="/editor/news">← Редакция новостей</Link></nav>
        <h1>Модерация комментариев</h1>
        <p className={styles.muted}>Новые комментарии появляются на сайте только после одобрения.
            Скрытые и отклонённые сообщения остаются в редакционном журнале.</p>
        <nav className={styles.filters} aria-label="Фильтр комментариев">
            {filters.map(item => <Link key={item.id} aria-current={filter === item.id ? "page" : undefined}
                className={filter === item.id ? styles.active : ""} href={link(item.id)}>
                {item.label}{item.id === "pending" ? ` (${pendingCount})` : item.id === "reported" ? ` (${reportedCount})` : ""}
            </Link>)}
        </nav>
        <p className={styles.muted}>Найдено: {total}</p>
        {items.length === 0 && <p className={styles.empty}>В этой очереди сообщений нет.</p>}
        <div className={styles.list}>{items.map(item => <article key={item.id} className={styles.card}>
            <div className={styles.head}>
                <strong>{commentAuthorLabel(item.author.displayName)}</strong>
                <span>{labels[item.status]} · {formatDate.format(item.createdAt)}</span>
            </div>
            <p className={styles.newsTitle}>Новость: <Link href={`/editor/news/${item.post.id}/review`}>{item.post.title}</Link></p>
            <p className={styles.message}>{item.body}</p>
            {item.parentId && <p className={styles.muted}>Ответ на другой комментарий</p>}
            {item.reports.length > 0 && <div className={styles.reports}>
                <strong>Жалобы ({item._count.reports})</strong>
                {item.reports.map(report => <p key={report.id}>{report.reason}</p>)}
            </div>}
            {item.events.length > 0 && <details className={styles.history}><summary>История решений</summary><ul>
                {item.events.map(ev => <li key={ev.id}>{formatDate.format(ev.createdAt)} · {ev.action}
                    {ev.note ? ` — ${ev.note}` : ""}</li>)}
            </ul></details>}
            <ModerationActions commentId={item.id} status={item.status} updatedAt={item.updatedAt.toISOString()} />
        </article>)}</div>
        {pageCount > 1 && <nav className={styles.pagination} aria-label="Страницы комментариев">
            {page > 1 ? <Link href={link(filter, page - 1)}>← Назад</Link> : <span />}
            <span>{page} из {pageCount}</span>
            {page < pageCount ? <Link href={link(filter, page + 1)}>Далее →</Link> : <span />}
        </nav>}
    </main>;
}
