import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { PROPOSAL_REVIEW_STATUS_RU } from "@/lib/orgProposalReview.mjs";
import styles from "./proposals.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Предложения организаций — Управление", robots: { index: false, follow: false } };
const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });
const FILTERS = ["SUBMITTED", "RETURNED", "APPROVED", "CANCELLED", "DRAFT"];
export default async function OrgProposalsPage({ searchParams }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const params = await searchParams;
    const status = FILTERS.includes(params?.status) ? params.status : "SUBMITTED";
    const requested = Number(params?.page ?? "1");
    const page = Number.isSafeInteger(requested) && requested >= 1 && requested < 10000 ? requested : 1;
    const db = getPrisma();
    const [total, proposals] = await Promise.all([
        db.orgEditProposal.count({ where: { status } }),
        db.orgEditProposal.findMany({ where: { status }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * 25, take: 25, include: {
                organization: { select: { title: true, slug: true } },
                requester: { select: { displayName: true } },
            } }),
    ]);
    return <main className={styles.page}>
        <header className={styles.heading}><p className={styles.kicker}>Поток 96 / Справочник</p>
            <h2>Предложения изменений</h2>
            <p>Представители не публикуют изменения самостоятельно. Решения принимает только ADMIN с обязательным комментарием.</p>
        </header>
        <nav className={styles.tabs} aria-label="Фильтр предложений">{FILTERS.map(s =>
            <Link key={s} href={`/admin/org-proposals?status=${s}`} aria-current={status === s ? "page" : undefined}>
                {PROPOSAL_REVIEW_STATUS_RU[s]}</Link>)}</nav>
        <p className={styles.muted}>Предложений: {total}</p>
        {proposals.length === 0 ? <p className={styles.panel}>Пока нет предложений с этим статусом.</p> :
            <div className={styles.list}>{proposals.map(p => <article key={p.id} className={styles.panel}>
                <div className={styles.row}><h3><Link href={`/admin/org-proposals/${p.id}`}>{p.organization.title}</Link></h3>
                    <span>{fmt.format(p.updatedAt)}</span></div>
                <p>Автор: {p.requester.displayName || "Пользователь"}</p>
                <p>{PROPOSAL_REVIEW_STATUS_RU[p.status]} · <Link href={`/orgs/${p.organization.slug}`}>Публичная карточка</Link></p>
                <Link href={`/admin/org-proposals/${p.id}`}>Посмотреть изменения →</Link>
            </article>)}</div>}
        <nav className={styles.pager} aria-label="Страницы предложений">
            {page > 1 ? <Link href={`/admin/org-proposals?status=${status}&page=${page - 1}`}>← Назад</Link> : <span/>}
            <span>Страница {page} из {Math.max(1, Math.ceil(total / 25))}</span>
            {page * 25 < total ? <Link href={`/admin/org-proposals?status=${status}&page=${page + 1}`}>Далее →</Link> : <span/>}
        </nav>
    </main>;
}
