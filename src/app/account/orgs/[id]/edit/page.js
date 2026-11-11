import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { canEditOrgProposal, ORG_ID, snapshotOrgFields } from "@/lib/orgProposal.mjs";
import OrgProposalEditor from "./OrgProposalEditor";
import styles from "./proposal.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Предложить изменения — Поток 96", robots: { index: false, follow: false } };

export default async function OrgProposalEditPage({ params }) {
    const actor = await getCurrentUser();
    if (!actor) redirect("/login");
    const { id } = await params;
    if (!ORG_ID.test(id)) notFound();
    const db = getPrisma();
    const [account, org, claim, proposal] = await Promise.all([
        db.user.findUnique({ where: { id: actor.id }, select: { id: true, archivedAt: true } }),
        db.organization.findUnique({ where: { id }, select: {
            id: true, slug: true, status: true, title: true, updatedAt: true,
            type: true, category: true, area: true, locality: true, address: true, phone: true,
            hours: true, tags: true, services: true, website: true, email: true,
            mapUrl: true, vkUrl: true, okUrl: true, maxUrl: true, content: true,
        } }),
        db.orgClaim.findFirst({ where: { orgId: id, requesterId: actor.id, status: "APPROVED" },
            select: { id: true, orgId: true, requesterId: true, status: true } }),
        db.orgEditProposal.findFirst({ where: { orgId: id, status: { in: ["DRAFT", "SUBMITTED", "RETURNED"] } },
            orderBy: { createdAt: "desc" }, select: {
                id: true, claimId: true, requesterId: true, status: true, updatedAt: true,
                fields: true, baseOrgUpdatedAt: true, submittedAt: true, reviewNote: true,
            } }),
    ]);
    if (!canEditOrgProposal({ actor: account, org, claim })) notFound();
    if (proposal && (proposal.requesterId !== actor.id || proposal.claimId !== claim.id)) notFound();

    return <main className={styles.page}>
        <Link href="/account/orgs" className={styles.back}>← Мои организации</Link>
        <header className={styles.heading}>
            <p className={styles.kicker}>Поток 96 / Организации</p>
            <h1>Предложить изменения</h1>
            <p>Организация: <strong>{org.title}</strong>. Поправки сохраняются отдельно и не меняют опубликованную страницу до решения редакции.</p>
            <Link href={`/orgs/${org.slug}`}>Посмотреть опубликованную карточку</Link>
        </header>
        <OrgProposalEditor key={proposal ? `${proposal.id}:${proposal.updatedAt.toISOString()}` : "new"}
            orgId={id} original={snapshotOrgFields(org)} proposal={proposal ? {
            ...proposal, updatedAt: proposal.updatedAt.toISOString(),
            baseOrgUpdatedAt: proposal.baseOrgUpdatedAt.toISOString(),
            submittedAt: proposal.submittedAt?.toISOString() ?? null,
        } : null} />
    </main>;
}
