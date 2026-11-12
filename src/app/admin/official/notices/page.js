import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import styles from "./official-notices.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Официальные сообщения — ADMIN", robots: { index: false, follow: false } };
const PER_PAGE = 20;
function href(q, status, page) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (page > 1) p.set("page", String(page));
    return `/admin/official/notices${p.size ? `?${p}` : ""}`;
}

export default async function OfficialNoticesAdminPage({ searchParams }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const p = await searchParams;
    const q = typeof p?.q === "string" ? p.q.trim().slice(0, 80) : "";
    const status = ["DRAFT", "PUBLISHED"].includes(p?.status) ? p.status : "";
    const n = Number(p?.page ?? 1);
    const requested = Number.isSafeInteger(n) && n > 0 && n < 10000 ? n : 1;
    const where = {
        ...(status ? { status } : {}),
        ...(q ? { OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { issuer: { contains: q, mode: "insensitive" } },
        ] } : {}),
    };
    const db = getPrisma();
    const count = await db.officialNotice.count({ where });
    const pages = Math.max(1, Math.ceil(count / PER_PAGE));
    const page = Math.min(requested, pages);
    const rows = await db.officialNotice.findMany({ where,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: (page - 1) * PER_PAGE, take: PER_PAGE,
        select: { id: true, slug: true, title: true, issuer: true, date: true, status: true },
    });
    return <main className={styles.page}>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Официально</p>
                <h2>Сообщения администрации и ведомств</h2>
                <p>Записей CMS: {count}. Старые Markdown-сообщения остаются на сайте, здесь не редактируются.</p></div>
            <Link href="/admin/official/notices/new" className={styles.primary}>+ Новое сообщение</Link>
        </header>
        <form action="/admin/official/notices" method="get" className={styles.filters}>
            <label>Название, ведомство или адрес страницы
                <input name="q" type="search" maxLength={80} defaultValue={q} placeholder="Поиск сообщений" /></label>
            <label>Статус<select name="status" defaultValue={status}>
                <option value="">Все</option><option value="DRAFT">Черновики</option>
                <option value="PUBLISHED">Опубликованные</option>
            </select></label>
            <button type="submit">Найти</button><Link href="/admin/official/notices">Сбросить</Link>
        </form>
        {!rows.length ? <section className={styles.empty}>Сообщений с такими параметрами пока нет.</section> :
            <div className={styles.items}>{rows.map(row => <article key={row.id} className={styles.item}>
                <div className={styles.meta}><span>{row.date.split("-").reverse().join(".")}</span>
                    <span>{row.issuer}</span><span className={styles.pill}>
                    {row.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span></div>
                <h3><Link href={`/admin/official/notices/${row.id}`}>{row.title}</Link></h3>
                <div className={styles.meta}><span>/{row.slug}</span>
                    {row.status === "PUBLISHED" &&
                        <Link href={`/official/notices/${row.slug}`}>Открыть на сайте</Link>}</div>
            </article>)}</div>}
        <nav className={styles.pager} aria-label="Страницы списка сообщений">
            {page > 1 ? <Link href={href(q, status, page - 1)}>← Назад</Link> : <span />}
            <span>Страница {page} из {pages}</span>
            {page < pages ? <Link href={href(q, status, page + 1)}>Далее →</Link> : <span />}
        </nav>
    </main>;
}
