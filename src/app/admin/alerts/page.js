import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { isOfficialAdmin } from "@/lib/officialNoticeCms";
import styles from "../official/notices/official-notices.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Городские службы — ADMIN", robots: { index: false, follow: false } };
const PER_PAGE = 20;
const names = { water: "Вода", electricity: "Электричество", gas: "Газ", heating: "Отопление", other: "Прочее" };
const stateNames = { planned: "Запланировано", active: "Действует", restored: "Восстановлено" };
function href(q, status, service, page) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (service) p.set("service", service);
    if (page > 1) p.set("page", String(page));
    return `/admin/alerts${p.size ? `?${p}` : ""}`;
}
export default async function AdminAlertsPage({ searchParams }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, me))) notFound();
    const p = await searchParams;
    const q = typeof p?.q === "string" ? p.q.trim().slice(0, 80) : "";
    const status = ["DRAFT", "PUBLISHED"].includes(p?.status) ? p.status : "";
    const service = Object.hasOwn(names, p?.service) ? p.service : "";
    const n = Number(p?.page ?? 1);
    const requested = Number.isSafeInteger(n) && n > 0 && n < 10000 ? n : 1;
    const where = {
        ...(status ? { status } : {}), ...(service ? { service } : {}),
        ...(q ? { OR: [
            { title: { contains: q, mode: "insensitive" } },
            { addresses: { contains: q, mode: "insensitive" } },
            { source: { contains: q, mode: "insensitive" } },
        ] } : {}),
    };
    const count = await db.serviceAlert.count({ where });
    const pages = Math.max(1, Math.ceil(count / PER_PAGE));
    const page = Math.min(requested, pages);
    const rows = await db.serviceAlert.findMany({
        where, orderBy: [{ startAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PER_PAGE, take: PER_PAGE,
        select: { id: true, slug: true, title: true, service: true, state: true, urgency: true,
            confirmed: true, status: true, startAt: true, source: true },
    });
    const format = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "short", timeStyle: "short" });
    return <main className={styles.page}>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Официально</p>
                <h2>Уведомления городских служб</h2>
                <p>Записей CMS: {count}. Старые Markdown-уведомления остаются доступными на сайте без редактирования.</p></div>
            <Link href="/admin/alerts/new" className={styles.primary}>+ Новое уведомление</Link>
        </header>
        <form action="/admin/alerts" method="get" className={styles.filters}>
            <label>Поиск по названию, адресу или источнику
                <input name="q" type="search" maxLength={80} defaultValue={q} placeholder="Поиск уведомлений" /></label>
            <label>Статус<select name="status" defaultValue={status}>
                <option value="">Все</option><option value="DRAFT">Черновики</option>
                <option value="PUBLISHED">Опубликованные</option></select></label>
            <label>Служба<select name="service" defaultValue={service}>
                <option value="">Все</option>{Object.entries(names).map(([value, label]) =>
                    <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="submit">Найти</button><Link href="/admin/alerts">Сбросить</Link>
        </form>
        {!rows.length ? <section className={styles.empty}>Уведомлений с такими параметрами пока нет.</section> :
            <div className={styles.items}>{rows.map(row => <article className={styles.item} key={row.id}>
                <div className={styles.meta}>
                    <span>{format.format(row.startAt)}</span><span>{names[row.service] ?? names.other}</span>
                    <span>{stateNames[row.state] ?? "Уточняется"}</span>
                    {row.urgency === "urgent" && <strong>Срочно</strong>}
                    <span className={styles.pill}>{row.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span>
                    {!row.confirmed && <span>Не подтверждено</span>}
                </div>
                <h3><Link href={`/admin/alerts/${row.id}`}>{row.title}</Link></h3>
                <div className={styles.meta}><span>{row.source || "Источник не указан"}</span>
                    {row.status === "PUBLISHED" && <Link href="/alerts">Открыть на сайте</Link>}</div>
            </article>)}</div>}
        <nav className={styles.pager} aria-label="Страницы списка уведомлений">
            {page > 1 ? <Link href={href(q, status, service, page - 1)}>← Назад</Link> : <span />}
            <span>Страница {page} из {pages}</span>
            {page < pages ? <Link href={href(q, status, service, page + 1)}>Далее →</Link> : <span />}
        </nav>
    </main>;
}
