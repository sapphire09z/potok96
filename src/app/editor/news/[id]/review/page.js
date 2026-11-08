import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { isNewsEditor } from "@/lib/newsDraft";
import ReviewActions from "./ReviewActions";
import styles from "./review.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редакционная проверка — Поток 96", robots: { index: false, follow: false } };
const labels = { DRAFT: "Черновик", REVIEW: "На проверке", APPROVED: "Одобрено", PUBLISHED: "Опубликовано", UNPUBLISHED: "Снято" };
const sourceLabels = { OWN: "Собственный материал", OFFICIAL: "Официальная информация", PRESS_RELEASE: "Пресс-релиз", THIRD_PARTY: "Материал другого СМИ / автора", OTHER: "Другое" };
const actionLabels = { SUBMITTED: "Отправлено на проверку", RETURNED: "Возвращено на доработку", APPROVED: "Одобрено", REOPENED: "Возвращено в черновики" };
const dates = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });

export default async function NewsReviewPage({ params }) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!isNewsEditor(user)) notFound();
    const { id } = await params;
    if (!/^c[a-z0-9]{10,40}$/.test(id)) notFound();

    const post = await getPrisma().newsPost.findUnique({
        where: { id },
        select: {
            id: true, slug: true, title: true, summary: true, body: true, category: true,
            status: true, authorName: true, updatedAt: true, tags: true, sourceKind: true,
            sourceName: true, sourceUrl: true, sourceText: true, rightsNote: true, coverImageId: true,
            images: {
                select: { id: true, caption: true, credit: true, rightsNote: true },
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
            workflowEvents: {
                select: { id: true, action: true, note: true, createdAt: true, actor: { select: { role: true } } },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 40,
            },
        },
    });
    if (!post) notFound();
    const cover = post.images.find((item) => item.id === post.coverImageId);
    const imagePath = (imageId, size) => `/api/editor/news/${post.id}/images/${imageId}?size=${size}`;

    return <main className={styles.page}>
        <nav className={styles.breadcrumbs}><Link href="/editor/news">← К списку новостей</Link></nav>
        <header className={styles.header}>
            <p className={styles.kicker}>Поток 96 / Редакционная проверка</p>
            <h1>{post.title}</h1>
            <p className={styles.meta}>{post.category} · {labels[post.status] ?? post.status} · Обновлено {dates.format(post.updatedAt)}</p>
            {post.status === "DRAFT" && <Link href={`/editor/news/${post.id}`} className={styles.edit}>Редактировать черновик</Link>}
        </header>

        <ReviewActions key={`${post.status}:${post.updatedAt.toISOString()}`} postId={post.id} status={post.status}
            updatedAt={post.updatedAt.toISOString()} isAdmin={user.role === "ADMIN"} />

        <section className={styles.article}>
            <p className={styles.kicker}>Предпросмотр материала (не опубликовано)</p>
            <h2>{post.title}</h2>
            {post.summary && <p className={styles.lead}>{post.summary}</p>}
            <p className={styles.meta}>{post.authorName}</p>
            {cover && <img src={imagePath(cover.id, "960")} alt={cover.caption || post.title} className={styles.cover} />}
            <div className={styles.body}><ReactMarkdown>{post.body}</ReactMarkdown></div>
            {post.tags.length > 0 && <p className={styles.meta}>{post.tags.map((tag) => `#${tag}`).join("  ")}</p>}
        </section>

        <section className={styles.audit}>
            <h2>Происхождение и права</h2>
            <p>Тип: <strong>{sourceLabels[post.sourceKind] ?? post.sourceKind}</strong></p>
            <p>Источник: {post.sourceName || "Не указан"} {post.sourceUrl && <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть оригинал</a>}</p>
            <p>Основание использования: {post.rightsNote || "Не указано"}</p>
            {post.sourceText && <details><summary>Исходный текст (только для редакции)</summary>
                <pre className={styles.sourceText}>{post.sourceText}</pre>
            </details>}
            <h3>Фотографии ({post.images.length})</h3>
            {post.images.map((photo) => <div key={photo.id} className={styles.photo}>
                <img src={imagePath(photo.id, "320")} alt={photo.caption || "Фотография материала"} />
                <div><p>{photo.caption || "Без подписи"}</p>
                    <p>Автор: {photo.credit || "Не указан"}</p>
                    <p>Права: {photo.rightsNote || "Не указаны"}</p>
                </div>
            </div>)}
        </section>
        <section className={styles.audit}>
            <h2>История редакционных решений</h2>
            {post.workflowEvents.length === 0 ? <p>Решений пока нет.</p> : <ol className={styles.history}>
                {post.workflowEvents.map((event) => <li key={event.id}>
                    <strong>{actionLabels[event.action] ?? event.action}</strong>
                    <span> {dates.format(event.createdAt)} · {event.actor?.role ?? "Сотрудник"}</span>
                    {event.note && <p>{event.note}</p>}
                </li>)}
            </ol>}
        </section>
    </main>;
}
