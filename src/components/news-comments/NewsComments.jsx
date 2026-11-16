import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { commentAuthorLabel, COMMENT_ROOT_LIMIT } from "@/lib/newsComments.mjs";
import { CommentControls, CommentForm } from "./CommentActions";
import styles from "./comments.module.css";

const dates = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });
const details = { id: true, body: true, status: true, authorId: true, createdAt: true,
    author: { select: { displayName: true } } };

function CommentItem({ item, currentUserId, slug, reply = false }) {
    const deleted = item.status === "DELETED";
    const isOwner = currentUserId && item.authorId === currentUserId;
    return <article className={`${styles.comment} ${reply ? styles.reply : ""}`}>
        <div className={styles.commentHead}>
            <strong>{deleted ? "Читатель" : commentAuthorLabel(item.author.displayName)}</strong>
            <time dateTime={item.createdAt.toISOString()}>{dates.format(item.createdAt)}</time>
        </div>
        <p className={deleted ? styles.deleted : styles.body}>{deleted ? "Комментарий удалён автором." : item.body}</p>
        {!deleted && <CommentControls commentId={item.id} canDelete={!!isOwner}
            canReport={!!currentUserId && !isOwner} />}
        {!reply && !deleted && currentUserId && <details className={styles.replyBox}>
            <summary>Ответить</summary>
            <CommentForm slug={slug} parentId={item.id} />
        </details>}
        {!reply && item.replies?.map(child => <CommentItem key={child.id} item={child}
            currentUserId={currentUserId} slug={slug} reply />)}
    </article>;
}

export default async function NewsComments({ postId, slug, page = 1 }) {
    const user = await getCurrentUser();
    const prisma = getPrisma();
    const where = { postId, parentId: null, OR: [
        { status: "APPROVED" },
        { status: "DELETED", replies: { some: { status: "APPROVED" } } },
    ] };
    const total = await prisma.newsComment.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / COMMENT_ROOT_LIMIT));
    const activePage = Math.min(page, pageCount);
    const [roots, pending] = await Promise.all([
        prisma.newsComment.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (activePage - 1) * COMMENT_ROOT_LIMIT, take: COMMENT_ROOT_LIMIT,
        select: { ...details, replies: { where: { status: "APPROVED" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 30, select: details } },
        }),
        user ? prisma.newsComment.findMany({ where: { postId, authorId: user.id, status: { in: ["PENDING", "REJECTED", "HIDDEN"] } },
            orderBy: { createdAt: "desc" }, take: 10,
            select: { id: true, body: true, status: true, moderationNote: true, createdAt: true } }) : [],
    ]);
    const count = roots.reduce((sum, root) => sum + (root.status === "APPROVED" ? 1 : 0) + root.replies.length, 0);
    return <section className={styles.section} id="comments" aria-labelledby="news-comments-title">
        <div className={styles.heading}><h2 id="news-comments-title">Комментарии</h2><span>{count}</span></div>
        {roots.length ? <div className={styles.list}>{roots.map(root => <CommentItem key={root.id} item={root}
            currentUserId={user?.id ?? null} slug={slug} />)}</div> :
            <p className={styles.muted}>Пока нет опубликованных комментариев. Можно начать обсуждение.</p>}
        {pageCount > 1 && <nav className={styles.pagination} aria-label="Страницы комментариев">
            {activePage > 1 ? <Link href={`/news/${encodeURIComponent(slug)}?commentsPage=${activePage - 1}#comments`}>← Новее</Link> : <span />}
            <span>Страница {activePage} из {pageCount}</span>
            {activePage < pageCount ? <Link href={`/news/${encodeURIComponent(slug)}?commentsPage=${activePage + 1}#comments`}>Ранее →</Link> : <span />}
        </nav>}
        {user && pending.length > 0 && <div className={styles.pending}>
            <h3>Мои комментарии: проверка и решения</h3>
            {pending.map(item => <div className={styles.pendingItem} key={item.id}>
                <p>{item.body}</p><small>{dates.format(item.createdAt)} · {item.status === "PENDING" ? "Ожидает модерации" : item.status === "REJECTED" ? "Отклонён" : "Скрыт"}</small>
                {item.moderationNote && <small>Причина: {item.moderationNote}</small>}
                <CommentControls commentId={item.id} canDelete canReport={false} />
            </div>)}
        </div>}
        {user ? <CommentForm slug={slug} /> :
            <p className={styles.muted}>Чтобы оставить комментарий, <Link href="/login">войдите в аккаунт</Link>.</p>}
    </section>;
}
