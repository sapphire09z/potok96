import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOrgCategoryTitle } from "@/lib/orgCategories";
import { isExtendedPlacement, placementDateInYekat } from "@/lib/orgPlacement";
import styles from "./orgs-admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Организации — Управление", robots: { index: false, follow: false } };
const SIZE = 20;
const formatter = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });

function href({ q, status, page }) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status) search.set("status", status);
    if (page > 1) search.set("page", String(page));
    const s = search.toString();
    return `/admin/orgs${s ? `?${s}` : ""}`;
}

export default async function OrganizationsAdminPage({ searchParams }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const params = await searchParams;
    const q = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
    const status = ["DRAFT", "PUBLISHED"].includes(params?.status) ? params.status : "";
    const requested = Number(params?.page ?? 1);
    const page = Number.isSafeInteger(requested) && requested >= 1 && requested < 10000 ? requested : 1;
    const where = {
        ...(status ? { status } : {}),
        ...(q ? { OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
            { locality: { contains: q, mode: "insensitive" } },
        ] } : {}),
    };
    const prisma = getPrisma();
    const [count, items] = await Promise.all([
        prisma.organization.count({ where }),
        prisma.organization.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * SIZE, take: SIZE,
            select: { id: true, title: true, slug: true, category: true, locality: true, status: true, updatedAt: true,
                placement: true, extendedUntil: true } }),
    ]);
    const pages = Math.max(1, Math.ceil(count / SIZE));

    return <main className={styles.page}>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Организации</p><h2>Управление справочником</h2>
                <p>Карточки PostgreSQL: {count}. Старые Markdown-организации продолжают работать и здесь не редактируются.</p></div>
            <Link href="/admin/orgs/new" className={styles.primaryLink}>+ Новая организация</Link>
        </header>
        <form className={styles.search} action="/admin/orgs" method="get">
            <label>Поиск по названию, адресу или slug<input type="search" name="q" maxLength={80} defaultValue={q} placeholder="Название организации" /></label>
            <label>Статус<select name="status" defaultValue={status}>
                <option value="">Все</option><option value="DRAFT">Черновики</option><option value="PUBLISHED">Опубликованные</option>
            </select></label>
            <button type="submit">Найти</button><Link href="/admin/orgs">Сбросить</Link>
        </form>
        {items.length === 0 ? <section className={styles.empty}>Карточек по выбранным условиям пока нет.</section> :
            <div className={styles.items}>{items.map(item => <article key={item.id} className={styles.item}>
                <div className={styles.row}><span>{getOrgCategoryTitle(item.category)}</span>
                    <span className={styles.pill}>{item.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span>
                    {item.placement === "EXTENDED" && <span className={styles.pill}>
                        {isExtendedPlacement(item) ? `Расширенная до ${placementDateInYekat(item.extendedUntil)}` : "Расширенная: срок истёк"}
                    </span>}</div>
                <h3><Link href={`/admin/orgs/${item.id}`}>{item.title}</Link></h3>
                <div className={styles.meta}><span>{item.locality || "Красноуфимск"}</span><span>/{item.slug}</span><span>Изменено {formatter.format(item.updatedAt)}</span>
                    {item.status === "PUBLISHED" && <Link href={`/orgs/${item.slug}`}>На сайте</Link>}</div>
            </article>)}</div>}
        <nav className={styles.pager} aria-label="Страницы организаций">
            {page > 1 ? <Link href={href({ q, status, page: page - 1 })}>← Назад</Link> : <span />}
            <span>Страница {Math.min(page,pages)} из {pages}</span>
            {page < pages ? <Link href={href({ q, status, page: page + 1 })}>Далее →</Link> : <span />}
        </nav>
    </main>;
}
