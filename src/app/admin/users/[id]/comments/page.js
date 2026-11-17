import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import {
    ADMIN_USER_COMMENTS_PER_PAGE, ADMIN_USER_COMMENT_STATUSES,
    normalizeAdminCommentStatus, normalizeAdminCommentPage, isPublicNewsCommentVisible,
} from "@/lib/adminUserComments.mjs";
import styles from "./comments.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
    title: "Комментарии пользователя — Поток 96",
    robots: { index: false, follow: false },
};

const USER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,99}$/;
const statusLabels = {
    ALL: "Все", PENDING: "На проверке", APPROVED: "Одобрены",
    REJECTED: "Отклонены", HIDDEN: "Скрыты", DELETED: "Удалены",
};
const itemLabels = {
    PENDING: "Ожидает проверки", APPROVED: "Одобрен",
    REJECTED: "Отклонён", HIDDEN: "Скрыт", DELETED: "Удалён автором",
};
const dateFormat = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short",
});

function filterUrl(id, status, page = 1) {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return `/admin/users/${encodeURIComponent(id)}/comments${search ? `?${search}` : ""}`;
}

export default async function AdminUserCommentsPage({ params, searchParams }) {
    // Do not rely on a parent layout to enforce admin-only visibility.
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();

    const { id } = await params;
    if (!USER_ID.test(id)) notFound();
    const query = await searchParams;
    const status = normalizeAdminCommentStatus(query?.status);
    const requestedPage = normalizeAdminCommentPage(query?.page);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, displayName: true, phone: true, email: true, role: true, archivedAt: true },
    });
    if (!user) notFound();

    const grouped = await prisma.newsComment.groupBy({
        by: ["status"], where: { authorId: user.id }, _count: { _all: true },
    });
    const counts = new Map(grouped.map(row => [row.status, row._count._all]));
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    const filteredTotal = status === "ALL" ? total : (counts.get(status) ?? 0);
    const pageCount = Math.max(1, Math.ceil(filteredTotal / ADMIN_USER_COMMENTS_PER_PAGE));
    const page = Math.min(requestedPage, pageCount);
    const comments = await prisma.newsComment.findMany({
        where: { authorId: user.id, ...(status === "ALL" ? {} : { status }) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * ADMIN_USER_COMMENTS_PER_PAGE,
        take: ADMIN_USER_COMMENTS_PER_PAGE,
        select: {
            id: true, body: true, status: true, createdAt: true, moderatedAt: true,
            moderationNote: true, parentId: true,
            post: {
                select: { id: true, slug: true, title: true, status: true,
                    publishedAt: true, commentsEnabled: true },
            },
            _count: { select: { reports: true, replies: true } },
        },
    });
    const displayName = user.displayName || user.phone || user.email || `ID: ${user.id}`;
    const now = new Date();

    return <main className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Навигация">
            <Link href="/admin/users">← Пользователи и роли</Link>
        </nav>
        <header className={styles.header}>
            <p className={styles.kicker}>Поток 96 / Администрирование</p>
            <h1>Комментарии пользователя</h1>
            <p className={styles.identity}><strong>{displayName}</strong> · {user.role}
                {user.archivedAt ? " · Архивный аккаунт" : ""}</p>
            <p className={styles.muted}>ID: <code>{user.id}</code></p>
            <p className={styles.muted}>Всего сообщений и ответов: <strong>{total}</strong>.
                Показаны все статусы, включая сообщения, недоступные посетителям.</p>
        </header>

        <nav className={styles.filters} aria-label="Фильтр комментариев по статусу">
            {["ALL", ...ADMIN_USER_COMMENT_STATUSES].map(value =>
                <Link key={value} href={filterUrl(user.id, value)}
                    aria-current={status === value ? "page" : undefined}
                    className={status === value ? styles.active : ""}>
                    {statusLabels[value]} <span>{value === "ALL" ? total : counts.get(value) ?? 0}</span>
                </Link>
            )}
        </nav>

        <p className={styles.muted}>Найдено: {filteredTotal}. Страница {page} из {pageCount}.</p>
        {comments.length === 0 ? <section className={styles.empty}>
            Комментариев с выбранным статусом нет.
        </section> : <div className={styles.list}>{comments.map(item =>
            <article key={item.id} className={styles.card}>
                <div className={styles.cardHeader}>
                    <span className={styles.status}>{itemLabels[item.status] ?? item.status}</span>
                    <time dateTime={item.createdAt.toISOString()}>{dateFormat.format(item.createdAt)} (Красноуфимск)</time>
                </div>
                <p className={styles.newsTitle}>Новость: <strong>{item.post.title}</strong></p>
                <p className={styles.commentText}>{item.status === "DELETED"
                    ? "Комментарий удалён автором. Текст удалён из базы данных."
                    : item.body}</p>
                <div className={styles.details}>
                    {item.parentId && <span>Ответ на комментарий</span>}
                    {item._count.replies > 0 && <span>Ответов: {item._count.replies}</span>}
                    {item._count.reports > 0 && <span>Жалоб: {item._count.reports}</span>}
                    {item.moderatedAt && <span>Решение модератора: {dateFormat.format(item.moderatedAt)}</span>}
                    {item.moderationNote && item.status !== "DELETED" &&
                        <span>Причина решения: {item.moderationNote}</span>}
                </div>
                <div className={styles.links}>
                    <Link href={`/editor/news/${encodeURIComponent(item.post.id)}/review`}>Материал в редакции</Link>
                    {isPublicNewsCommentVisible(item, now) &&
                        <Link href={`/news/${encodeURIComponent(item.post.slug)}#comments`}>Открыть новость на сайте</Link>}
                </div>
            </article>
        )}</div>}

        {pageCount > 1 && <nav className={styles.pagination} aria-label="Страницы истории комментариев">
            {page > 1 ? <Link href={filterUrl(user.id, status, page - 1)}>← Новее</Link> : <span />}
            <span>Страница {page} из {pageCount}</span>
            {page < pageCount ? <Link href={filterUrl(user.id, status, page + 1)}>Ранее →</Link> : <span />}
        </nav>}
    </main>;
}
