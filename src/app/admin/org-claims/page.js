import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { CLAIM_STATUS_RU } from "@/lib/orgClaims.mjs";
import OrgClaimReview from "./OrgClaimReview";
import styles from "./claims.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявки представителей — Управление", robots: { index: false, follow: false } };
const formatter = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });

export default async function OrgClaimsAdminPage({ searchParams }) {
    const admin = await getCurrentUser();
    if (!admin) redirect("/login");
    if (admin.role !== "ADMIN") notFound();
    const params = await searchParams;
    const status = ["PENDING", "APPROVED", "REJECTED", "REVOKED"].includes(params?.status)
        ? params.status : "PENDING";
    const requested = Number(params?.page ?? 1);
    const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= 10000 ? requested : 1;
    const size = 30;
    const where = { status };
    const prisma = getPrisma();
    const [total, claims] = await Promise.all([
        prisma.orgClaim.count({ where }),
        prisma.orgClaim.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * size, take: size,
            include: {
                organization: { select: { title: true, slug: true, status: true } },
                requester: { select: { displayName: true, phone: true, archivedAt: true } },
            } }),
    ]);
    const query = target => `/admin/org-claims?status=${status}&page=${target}`;
    return <main className={styles.page}>
        <header className={styles.heading}>
            <p className={styles.kicker}>Поток 96 / Управление</p>
            <h2>Заявки представителей организаций</h2>
            <p>Подтверждённый телефон не доказывает право управлять организацией. Перед одобрением проверьте полномочия по независимому официальному каналу и запишите способ проверки.</p>
        </header>
        <nav className={styles.tabs} aria-label="Статусы заявок">
            {Object.entries(CLAIM_STATUS_RU).map(([value, label]) =>
                <Link key={value} href={`/admin/org-claims?status=${value}`} aria-current={status === value ? "page" : undefined}>{label}</Link>)}
        </nav>
        <p className={styles.count}>Заявок: {total}</p>
        {!claims.length && <p className={styles.empty}>Заявок с этим статусом нет.</p>}
        <div className={styles.list}>{claims.map(claim => <article key={claim.id} className={styles.card}>
            <div className={styles.row}>
                <div><h3>{claim.organization.title}</h3>
                    <Link href={`/orgs/${claim.organization.slug}`}>Посмотреть страницу</Link>
                    <span>{claim.organization.status === "PUBLISHED" ? "Опубликовано" : "Не опубликовано"}</span>
                </div>
                <span>{formatter.format(claim.createdAt)}</span>
            </div>
            <div className={styles.details}>
                <div><strong>Заявитель</strong><span>{claim.requester.displayName || "Без имени"}</span>
                    <span>{claim.requester.phone || "Телефон отсутствует"}</span>
                    {claim.requester.archivedAt && <span>Аккаунт архивирован</span>}</div>
                <div><strong>Указанная роль</strong><span>{claim.roleDescription}</span></div>
                <div><strong>Способ подтверждения (со слов заявителя)</strong><span>{claim.evidenceNote}</span></div>
            </div>
            {claim.reviewNote && <p className={styles.history}>Проверка: {claim.reviewNote}</p>}
            {claim.revocationNote && <p className={styles.history}>Отзыв: {claim.revocationNote}</p>}
            {(status === "PENDING" || status === "APPROVED") && <OrgClaimReview claimId={claim.id} status={claim.status} />}
        </article>)}</div>
        <nav className={styles.pager} aria-label="Страницы заявок">
            {page > 1 ? <Link href={query(page - 1)}>← Назад</Link> : <span />}
            <span>Страница {page} из {Math.max(1, Math.ceil(total / size))}</span>
            {page * size < total ? <Link href={query(page + 1)}>Далее →</Link> : <span />}
        </nav>
    </main>;
}
