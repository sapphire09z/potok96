import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getAllOrgs } from "@/lib/orgs";

import styles from "./orgs.module.css";
export const metadata = {
    title: "Справочник организаций",
    description: "Организации, учреждения, секции и услуги Красноуфимска и района.",
};
export default async function OrgsPage() {
    const orgs = await getAllOrgs();

    const publishedOrgs = orgs
        .filter((org) => org.status === "published")
        .sort((a, b) => a.title.localeCompare(b.title, "ru"));

    const types = Array.from(
        new Set(publishedOrgs.map((org) => org.type).filter(Boolean))
    );

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>Справочник</div>
                <h1>Организации города</h1>
                <p>
                    Компании, учреждения, секции, услуги и городские места Красноуфимска
                    и района.
                </p>
            </header>

            {types.length > 0 && (
                <section className={styles.types}>
                    {types.map((type) => (
                        <span key={type}>{type}</span>
                    ))}
                </section>
            )}

            <section className={styles.listSection}>
                <div className={styles.sectionHeader}>
                    <h2>Все организации</h2>
                    <span>{publishedOrgs.length}</span>
                </div>

                {publishedOrgs.length === 0 ? (
                    <EmptyState
                        title="Организаций пока нет"
                        text="Справочник скоро начнёт наполняться городскими организациями."
                    />
                ) : (
                    <div className={styles.orgsGrid}>
                        {publishedOrgs.map((org) => (
                            <Link
                                key={org.slug}
                                href={`/orgs/${org.slug}`}
                                className={styles.orgCard}
                            >
                                <div className={styles.orgType}>{org.type}</div>

                                <h3>{org.title}</h3>

                                <div className={styles.orgInfo}>
                                    {org.address && <span>{org.address}</span>}
                                    {org.phone && <span>{org.phone}</span>}
                                    {org.hours && <span>{org.hours}</span>}
                                </div>

                                {org.tags?.length > 0 && (
                                    <div className={styles.tags}>
                                        {org.tags.slice(0, 4).map((tag) => (
                                            <span key={tag}>#{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}