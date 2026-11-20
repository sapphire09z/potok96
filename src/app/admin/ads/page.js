import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import ResourceDeleteButton from "@/components/admin/ResourceDeleteButton";
import styles from "../orgs/orgs-admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Объявления — ADMIN", robots: { index: false, follow: false } };
const SIZE = 30;
const statuses = ["DRAFT", "PENDING", "APPROVED", "PUBLISHED", "REJECTED", "PAUSED", "CLOSED", "EXPIRED", "DELETING"];
const labels = { DRAFT: "Черновик", PENDING: "На модерации", APPROVED: "Одобрено", PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено", PAUSED: "Приостановлено", CLOSED: "Закрыто", EXPIRED: "Истёк срок", DELETING: "Очистка не завершена" };
const dateLabel = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium" });
function url(q, status, page) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/admin/ads${params.size ? `?${params}` : ""}`;
}

export default async function AdminAdsPage({ searchParams }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") notFound();
  const db = getPrisma();
  const account = await db.user.findUnique({ where: { id: actor.id }, select: { role: true, archivedAt: true } });
  if (account?.role !== "ADMIN" || account.archivedAt) notFound();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
  const status = statuses.includes(params?.status) ? params.status : "";
  const rawPage = Number(params?.page ?? 1);
  const requestedPage = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage < 10000 ? rawPage : 1;
  const where = {
    ...(status ? { status } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const count = await db.classifiedAd.count({ where });
  const pages = Math.max(1, Math.ceil(count / SIZE));
  const page = Math.min(pages, requestedPage);
  const ads = await db.classifiedAd.findMany({ where,
    select: { id: true, title: true, slug: true, status: true, updatedAt: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * SIZE, take: SIZE });

  return <main className={styles.page}>
    <Link href="/admin" className={styles.back}>← В ADMIN</Link>
    <header className={styles.heading}>
      <div><p className={styles.kicker}>Поток 96 / Объявления</p><h2>Все объявления</h2>
        <p>Администратор может удалить любое объявление. Владелец может удалить собственное из личного кабинета. Автоматической очистки нет.</p></div>
    </header>
    <form className={styles.search} method="get" action="/admin/ads">
      <label>Название<input name="q" type="search" defaultValue={q} maxLength={80} /></label>
      <label>Статус<select name="status" defaultValue={status}><option value="">Все</option>
        {statuses.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label>
      <button type="submit">Найти</button><Link href="/admin/ads">Сбросить</Link>
    </form>
    <p className={styles.meta}>Найдено объявлений: {count}.</p>
    {ads.length === 0 ? <p className={styles.empty}>Объявлений нет.</p> : <div className={styles.items}>
      {ads.map(ad => <article key={ad.id} className={styles.item}>
        <div className={styles.row}><span>{labels[ad.status] || ad.status}</span><span>{dateLabel.format(ad.createdAt)}</span></div>
        <h3>{ad.title}</h3>
        <div className={styles.meta}>
          <span>ID: {ad.id}</span>
          {ad.slug && ad.status === "PUBLISHED" && <Link href={`/ads/${ad.slug}`}>На сайте</Link>}
          <ResourceDeleteButton kind="ads" id={ad.id} title={ad.title}
            updatedAt={ad.updatedAt.toISOString()} deleting={ad.status === "DELETING"} />
        </div>
      </article>)}
    </div>}
    <nav className={styles.pager} aria-label="Страницы объявлений">
      {page > 1 ? <Link href={url(q, status, page - 1)}>← Назад</Link> : <span />}
      <span>{page} / {pages}</span>
      {page < pages ? <Link href={url(q, status, page + 1)}>Вперёд →</Link> : <span />}
    </nav>
  </main>;
}
