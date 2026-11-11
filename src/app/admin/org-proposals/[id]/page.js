import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { ORG_ID, snapshotOrgFields } from "@/lib/orgProposal.mjs";
import { PROPOSAL_REVIEW_STATUS_RU, proposalChangedFields,
    showProposalField, mayApproveOrgProposal } from "@/lib/orgProposalReview.mjs";
import OrgProposalReviewControls from "../OrgProposalReviewControls";
import styles from "../proposals.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Рассмотрение изменений — Поток 96", robots: { index: false, follow: false } };
const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short" });

export default async function OrgProposalDetail({ params }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    if (me.role !== "ADMIN") notFound();
    const { id } = await params;
    if (!ORG_ID.test(id)) notFound();
    const p = await getPrisma().orgEditProposal.findUnique({ where: { id }, include: {
        organization: true, requester: { select: { id: true, displayName: true, phone: true, archivedAt: true } },
        claim: { select: { id: true, status: true, orgId: true, requesterId: true } },
        reviewEvents: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    } });
    if (!p) notFound();
    const changes = proposalChangedFields(p.baseFields, p.fields);
    const stale = ["SUBMITTED", "RETURNED", "DRAFT"].includes(p.status) &&
        p.organization.updatedAt.getTime() !== p.baseOrgUpdatedAt.getTime();
    const mayApprove = mayApproveOrgProposal({ proposal: p, organization: p.organization,
        claim: p.claim, requester: p.requester });
    const current = snapshotOrgFields(p.organization);
    const changedNow = proposalChangedFields(p.baseFields, current);
    return <main className={styles.page}>
        <Link href="/admin/org-proposals" className={styles.back}>← К предложениям</Link>
        <header className={styles.heading}>
            <p className={styles.kicker}>Поток 96 / Модерация</p><h2>{p.organization.title}</h2>
            <p>{PROPOSAL_REVIEW_STATUS_RU[p.status]} · Автор: {p.requester.displayName || p.requester.phone || "Пользователь"}
                {p.submittedAt ? ` · Отправлено ${fmt.format(p.submittedAt)}` : ""}</p>
            <Link href={`/orgs/${p.organization.slug}`}>Открыть публичную карточку ↗</Link>
        </header>
        {stale && <section className={styles.warning} role="alert">
            <strong>Опубликованная карточка изменилась после создания предложения.</strong>
            <p>Автоматическое одобрение заблокировано. Верните предложение на доработку: представитель сможет удалить устаревший черновик и создать новый.</p>
            {changedNow.length > 0 && <p>Изменились поля: {changedNow.map(x => x.label).join(", ")}.</p>}
        </section>}
        <section className={styles.panel}>
            <h3>Что предлагает представитель</h3>
            <p className={styles.muted}>Показаны только изменённые поля. Первая колонка — состояние на момент создания черновика, вторая — предложенная версия.</p>
            {changes.length === 0 ? <p>Изменённых полей нет.</p> : changes.map(c =>
                <div key={c.key} className={styles.change}>
                    <h4>{c.label}</h4>
                    <div className={styles.compare}>
                        <div><span>Было</span><pre>{showProposalField(c.before) || "—"}</pre></div>
                        <div><span>Предлагается</span><pre>{showProposalField(c.after) || "—"}</pre></div>
                    </div>
                </div>)}
        </section>
        {p.status === "SUBMITTED" && <OrgProposalReviewControls proposalId={id}
            updatedAt={p.updatedAt.toISOString()} canApprove={mayApprove}/>}
        <section className={styles.panel}>
            <h3>История решений редакции</h3>
            {p.reviewEvents.length === 0 ? <p className={styles.muted}>Пока решений нет.</p> :
                <div className={styles.events}>{p.reviewEvents.map(e =>
                    <article key={e.id}><strong>{PROPOSAL_REVIEW_STATUS_RU[e.action] ?? e.action}</strong>
                        <span>{fmt.format(e.createdAt)}</span><p>{e.note}</p></article>)}</div>}
        </section>
    </main>;
}
