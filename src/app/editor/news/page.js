import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import styles from "./news-editor.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Редакция — Новости",
    robots: { index: false, follow: false },
};

const statusLabels = {
    DRAFT: "Черновик",
    REVIEW: "На проверке",
    APPROVED: "Одобрено",
    PUBLISHED: "Опубликовано",
    UNPUBLISHED: "Снято с публикации",
};

const filters = [
    { status: "", label: "Все" },
    { status: "DRAFT", label: "Черновики" },
    { status: "REVIEW", label: "На проверке" },
    { status: "APPROVED", label: "Одобрено" },
    { status: "PUBLISHED", label: "Опубликованные" },
    { status: "UNPUBLISHED", label: "Снятые" },
];

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg",
    dateStyle: "medium",
    timeStyle: "short",
});

export default async function EditorNewsPage({ searchParams }) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!["ADMIN", "MODERATOR"].includes(user.role)) notFound();

    const params = await searchParams;
    const requested = typeof params?.status === "string" ? params.status : "";
    const selected = Object.prototype.hasOwnProperty.call(statusLabels, requested) ? requested : "";

    const prisma = getPrisma();
    const [posts, totals] = await Promise.all([
        prisma.newsPost.findMany({
            where: selected ? { status: selected } : undefined,
            select: {
                id: true,
                title: true,
                slug: true,
                category: true,
                status: true,
                updatedAt: true,
                publishedAt: true,
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 100,
        }),
        prisma.newsPost.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
    ]);

    const counts = Object.fromEntries(
        totals.map((row) => [row.status, row._count._all])
    );
    const total = totals.reduce((sum, row) => sum + row._count._all, 0);

    return (
        <div className={styles.page}>
            <nav className={styles.breadcrumbs} aria-label="Навигация редакции">
                <Link href="/account">Личный кабинет</Link>
                <span aria-hidden="true">/</span>
                <span>Новости</span>
            </nav>

            <header className={styles.heading}>
                <p className={styles.kicker}>Поток 96 / Редакция</p>
                <h1>Управление новостями</h1>
                <p>Материалы в базе данных: {total}. После публикации статьи из CMS
                    появляются в общей новостной ленте вместе с существующими Markdown-материалами.</p>
                <Link href="/editor/news/new" className={styles.createLink}>+ Создать новость</Link>
            </header>

            <nav className={styles.filters} aria-label="Фильтр новостей">
                {filters.map(({ status, label }) => (
                    <Link
                        key={status}
                        href={status ? `/editor/news?status=${status}` : "/editor/news"}
                        aria-current={selected === status ? "page" : undefined}
                        className={selected === status ? styles.active : ""}
                    >
                        {label} <span>{status ? counts[status] ?? 0 : total}</span>
                    </Link>
                ))}
            </nav>

            {posts.length === 0 ? (
                <section className={styles.empty}>
                    <h2>Материалов пока нет</h2>
                    <p>
                        {selected
                            ? "В выбранном статусе нет новостей."
                            : "Создайте первый черновик через кнопку выше."}
                    </p>
                </section>
            ) : (
                <div className={styles.list}>
                    {posts.map((post) => (
                        <article key={post.id} className={styles.item}>
                            <div className={styles.itemTop}>
                                <span>{post.category}</span>
                                <span className={styles.status}>{statusLabels[post.status]}</span>
                            </div>
                            <h2><Link href={`/editor/news/${post.id}/review`}>{post.title}</Link></h2>
                            <div className={styles.meta}>
                                {post.status === "DRAFT" && <Link href={`/editor/news/${post.id}`}>Редактировать</Link>}
                                <Link href={`/editor/news/${post.id}/review`}>Проверка и история</Link>
                                <span>Обновлено {timeFormatter.format(post.updatedAt)}</span>
                                {post.publishedAt && (
                                    <span>Опубликовано {timeFormatter.format(post.publishedAt)}</span>
                                )}
                                <span>/{post.slug}</span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {posts.length === 100 && (
                <p className={styles.note}>Показаны первые 100 материалов. Постраничный просмотр добавим отдельно.</p>
            )}
        </div>
    );
}
