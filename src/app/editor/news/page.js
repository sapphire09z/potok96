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

const PER_PAGE = 20;
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

function newsListUrl({ status = "", q = "", page = 1 }) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/editor/news${query ? `?${query}` : ""}`;
}

export default async function EditorNewsPage({ searchParams }) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!["ADMIN", "MODERATOR"].includes(user.role)) notFound();

    const params = await searchParams;
    const requestedStatus = typeof params?.status === "string" ? params.status : "";
    const selected = Object.hasOwn(statusLabels, requestedStatus) ? requestedStatus : "";
    const q = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
    const requestedPage = Number(params?.page ?? 1);
    const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000
        ? requestedPage : 1;

    const prisma = getPrisma();
    const searchWhere = q ? {
        OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { authorName: { contains: q, mode: "insensitive" } },
        ],
    } : {};

    // Status counts follow the current search, so tabs always show the size of
    // the actual result set rather than counts for unrelated material.
    const totals = await prisma.newsPost.groupBy({
        by: ["status"],
        where: searchWhere,
        _count: { _all: true },
    });
    const counts = Object.fromEntries(totals.map((row) => [row.status, row._count._all]));
    const foundTotal = totals.reduce((sum, row) => sum + row._count._all, 0);
    const selectedTotal = selected ? counts[selected] ?? 0 : foundTotal;
    const pageCount = Math.max(1, Math.ceil(selectedTotal / PER_PAGE));
    const page = Math.min(pageNumber, pageCount);

    const posts = await prisma.newsPost.findMany({
        where: selected ? { ...searchWhere, status: selected } : searchWhere,
        select: {
            id: true, title: true, slug: true, category: true, status: true,
            updatedAt: true, publishedAt: true, featured: true, featuredOrder: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: PER_PAGE,
        skip: (page - 1) * PER_PAGE,
    });
    const firstResult = selectedTotal ? (page - 1) * PER_PAGE + 1 : 0;
    const lastResult = Math.min(page * PER_PAGE, selectedTotal);

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
                <p>После публикации статьи из CMS появляются в общей новостной ленте
                    вместе с существующими Markdown-материалами.</p>
                <Link href="/editor/news/new" className={styles.createLink}>+ Создать новость</Link>
            </header>

            <form className={styles.searchForm} action="/editor/news" method="get" role="search">
                <label htmlFor="editor-news-query">Поиск новостей</label>
                <div className={styles.searchRow}>
                    <input id="editor-news-query" type="search" name="q" defaultValue={q}
                        maxLength={80} placeholder="Заголовок, адрес, рубрика, текст анонса или автор" />
                    {selected && <input type="hidden" name="status" value={selected} />}
                    <button type="submit">Найти</button>
                    {(q || selected) && <Link href="/editor/news">Сбросить</Link>}
                </div>
            </form>

            <nav className={styles.filters} aria-label="Фильтр новостей">
                {filters.map(({ status, label }) => (
                    <Link key={status} href={newsListUrl({ status, q })}
                        aria-current={selected === status ? "page" : undefined}
                        className={selected === status ? styles.active : ""}>
                        {label} <span>{status ? counts[status] ?? 0 : foundTotal}</span>
                    </Link>
                ))}
            </nav>

            <p className={styles.resultsCount} role="status">
                {selectedTotal
                    ? `Показано ${firstResult}–${lastResult} из ${selectedTotal} материалов`
                    : "Ничего не найдено"}
                {q && <> по запросу «{q}»</>}
            </p>

            {posts.length === 0 ? (
                <section className={styles.empty}>
                    <h2>Материалы не найдены</h2>
                    <p>{q
                        ? "Попробуйте изменить поисковый запрос или сбросить фильтр."
                        : selected
                            ? "В выбранном статусе нет новостей."
                            : "Создайте первый черновик через кнопку выше."}</p>
                </section>
            ) : (
                <div className={styles.list}>
                    {posts.map((post) => (
                        <article key={post.id} className={styles.item}>
                            <div className={styles.itemTop}>
                                <span>{post.category}</span>
                                <span className={styles.status}>{statusLabels[post.status]}</span>
                                {post.status === "PUBLISHED" && post.featured &&
                                    <span className={styles.status}>★ В главных · №{post.featuredOrder}</span>}
                            </div>
                            <h2><Link href={`/editor/news/${post.id}/review`}>{post.title}</Link></h2>
                            <div className={styles.meta}>
                                {post.status === "DRAFT" && <Link href={`/editor/news/${post.id}`}>Редактировать</Link>}
                                <Link href={`/editor/news/${post.id}/review`}>Проверка и история</Link>
                                <span>Обновлено {timeFormatter.format(post.updatedAt)}</span>
                                {post.publishedAt && <span>Опубликовано {timeFormatter.format(post.publishedAt)}</span>}
                                <span>/{post.slug}</span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {pageCount > 1 && (
                <nav className={styles.pagination} aria-label="Страницы списка новостей">
                    {page > 1
                        ? <Link href={newsListUrl({ status: selected, q, page: page - 1 })}>← Предыдущая</Link>
                        : <span aria-hidden="true" />}
                    <span>Страница {page} из {pageCount}</span>
                    {page < pageCount
                        ? <Link href={newsListUrl({ status: selected, q, page: page + 1 })}>Следующая →</Link>
                        : <span aria-hidden="true" />}
                </nav>
            )}
        </div>
    );
}
