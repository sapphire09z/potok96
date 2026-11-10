import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { CLAIM_STATUS_RU } from "@/lib/orgClaims.mjs";
import OrgClaimForm from "./OrgClaimForm";
import styles from "./org-claims.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мои организации — Поток 96", robots: { index: false, follow: false } };

export default async function AccountOrganizations({ searchParams }) {
    const me = await getCurrentUser();
    if (!me) redirect("/login");
    const params = await searchParams;
    const slug = typeof params?.organization === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.organization)
        ? params.organization.slice(0, 160) : "";
    const prisma = getPrisma();
    const [requests, selected] = await Promise.all([
        prisma.orgClaim.findMany({ where: { requesterId: me.id }, orderBy: { createdAt: "desc" }, take: 100,
            include: { organization: { select: { title: true, slug: true } } } }),
        slug ? prisma.organization.findFirst({ where: { slug, status: "PUBLISHED" },
            select: { id: true, title: true, slug: true, orgClaims: { where: { status: "APPROVED" }, select: { id: true } } } }) : Promise.resolve(null),
    ]);
    const existing = selected && requests.some(item => item.orgId === selected.id &&
        ["PENDING", "APPROVED"].includes(item.status));
    const alreadyManaged = Boolean(selected?.orgClaims.length);
    return <main className={styles.page}>
        <Link href="/account" className={styles.back}>← Личный кабинет</Link>
        <header className={styles.heading}>
            <p className={styles.kicker}>Поток 96 / Бизнес</p>
            <h1>Мои организации</h1>
            <p>Здесь можно запросить управление карточкой организации. Заявку проверяет администратор. После одобрения право управления сохраняется за вашей учётной записью, но редактирование пока не включено.</p>
        </header>
        {selected && !existing && !alreadyManaged && <OrgClaimForm organization={selected} />}
        {selected && alreadyManaged && !existing && <section className={styles.panel}><p>У этой организации уже есть подтверждённый представитель. Для смены представителя обратитесь в редакцию.</p></section>}
        {selected && existing && <section className={styles.panel}><p>По организации «{selected.title}» уже есть действующая заявка или подтверждённый доступ.</p></section>}
        {slug && !selected && <section className={styles.panel}><p>Организация не найдена или её карточка пока не опубликована в новой системе.</p></section>}
        {!slug && <section className={styles.panel}>
            <h2>Как подать заявку</h2>
            <p>Откройте карточку организации в <Link href="/orgs">справочнике</Link> и выберите «Я представляю организацию». Для старых карточек на Markdown заявка станет доступна после их переноса в CMS.</p>
        </section>}
        <section className={styles.panel}>
            <h2>История заявок</h2>
            {!requests.length ? <p>Заявок пока нет.</p> : <div className={styles.list}>{requests.map(item =>
                <article key={item.id} className={styles.item}>
                    <div><strong>{item.organization.title}</strong><span>{item.roleDescription}</span></div>
                    <div className={styles.status}>{CLAIM_STATUS_RU[item.status] ?? item.status}</div>
                    {item.status === "APPROVED" && <p>Полномочия подтверждены. Интерфейс отправки правок появится следующим этапом.</p>}
                    {item.status === "REJECTED" && <p>Для уточнения причины отказа свяжитесь с редакцией.</p>}
                </article>)}</div>}
        </section>
    </main>;
}
