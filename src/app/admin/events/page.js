import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { getEventCategoryTitle } from "@/lib/eventCategories";
import styles from "./events-admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Управление мероприятиями — Поток 96", robots: { index: false, follow: false } };
const PER_PAGE = 20;
const format = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short",
});
function href(q, status, page) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    return `/admin/events${params.size ? `?${params}` : ""}`;
}

export default async function EventsAdminPage({ searchParams }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const params = await searchParams;
    const q = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
    const status = ["DRAFT", "PUBLISHED"].includes(params?.status) ? params.status : "";
    const requestedPage = Number(params?.page ?? 1);
    const requested = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage < 10000 ? requestedPage : 1;
    const where = {
        ...(status ? { status } : {}),
        ...(q ? { OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
        ] } : {}),
    };
    const db = getPrisma();
    const count = await db.eventPost.count({ where });
    const pages = Math.max(1, Math.ceil(count / PER_PAGE));
    const page = Math.min(requested, pages);
    const rows = await db.eventPost.findMany({ where,
        orderBy: [{ startAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PER_PAGE, take: PER_PAGE,
        select: { id: true, slug: true, title: true, category: true, location: true,
            status: true, startAt: true, updatedAt: true, pushkinCard: true },
    });

    return <main className={styles.page}>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Афиша</p>
                <h2>Управление мероприятиями</h2>
                <p>События PostgreSQL: {count}. Существующие Markdown-события остаются на сайте и здесь пока не редактируются.</p></div>
            <Link href="/admin/events/new" className={styles.primary}>+ Новое мероприятие</Link>
        </header>
        <form action="/admin/events" method="get" className={styles.filters}>
            <label>Поиск по названию, месту или адресу страницы
                <input name="q" type="search" maxLength={80} defaultValue={q} placeholder="Название мероприятия" /></label>
            <label>Статус<select name="status" defaultValue={status}>
                <option value="">Все</option><option value="DRAFT">Черновики</option>
                <option value="PUBLISHED">Опубликованные</option>
            </select></label>
            <button type="submit">Найти</button><Link href="/admin/events">Сбросить</Link>
        </form>
        {!rows.length ? <section className={styles.empty}>Мероприятий с такими параметрами пока нет.</section> :
            <div className={styles.items}>{rows.map(row => <article key={row.id} className={styles.item}>
                <div className={styles.meta}>
                    <span>{getEventCategoryTitle(row.category)}</span>
                    <span className={styles.pill}>{row.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span>
                    {row.pushkinCard && <span className={styles.pill}>Пушкинская карта</span>}
                </div>
                <h3><Link href={`/admin/events/${row.id}`}>{row.title}</Link></h3>
                <div className={styles.meta}><span>{format.format(row.startAt)}</span>
                    {row.location && <span>{row.location}</span>}<span>/{row.slug}</span>
                    {row.status === "PUBLISHED" && <Link href={`/events/${row.slug}`}>Открыть на сайте</Link>}</div>
            </article>)}</div>}
        <nav className={styles.pager} aria-label="Страницы списка мероприятий">
            {page > 1 ? <Link href={href(q, status, page - 1)}>← Назад</Link> : <span />}
            <span>Страница {page} из {pages}</span>
            {page < pages ? <Link href={href(q, status, page + 1)}>Далее →</Link> : <span />}
        </nav>
    </main>;
}
