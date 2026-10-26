import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getAllOrgs } from "@/lib/orgs";

import styles from "./orgs.module.css";
export const metadata = {
    title: "Справочник организаций",
    description: "Организации, учреждения, секции и услуги Красноуфимска и района.",
};

export default async function OrgsPage({ searchParams }) {
    const params = await searchParams;

    const q =
        typeof params?.q === "string"
            ? params.q.trim()
            : "";

    const selectedType =
        typeof params?.type === "string"
            ? params.type
            : "";

    const publishedOrgs = (await getAllOrgs())
        .sort((a, b) => a.title.localeCompare(b.title, "ru"));

    const types = [...new Set(
        publishedOrgs.map((org) => org.type).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "ru"));

    const normalizedQuery = q.toLocaleLowerCase("ru-RU");

    const filteredOrgs = publishedOrgs.filter((org) => {
        const searchableText = [
            org.title,
            org.type,
            org.address,
            ...(Array.isArray(org.tags) ? org.tags : []),
            ...(Array.isArray(org.services) ? org.services : []),
        ]
            .join(" ")
            .toLocaleLowerCase("ru-RU");

        return (
            searchableText.includes(normalizedQuery) &&
            (!selectedType || org.type === selectedType)
        );
    });

    function typeHref(type) {
        const params = new URLSearchParams();

        if (q) params.set("q", q);
        if (type) params.set("type", type);

        const query = params.toString();
        return query ? `/orgs?${query}` : "/orgs";
    }


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

            <form
                action="/orgs"
                method="get"
                className={styles.searchForm}
            >
                <label htmlFor="org-search" className={styles.searchLabel}>
                    Найти организацию или услугу
                </label>

                <div className={styles.searchRow}>
                    <input
                        id="org-search"
                        type="search"
                        name="q"
                        defaultValue={q}
                        placeholder="Название, услуга, направление..."
                        maxLength={120}
                    />

                    {selectedType && (
                        <input type="hidden" name="type" value={selectedType} />
                    )}

                    <button type="submit">Найти</button>

                    {(q || selectedType) && (
                        <Link href="/orgs" className={styles.reset}>
                            Сбросить
                        </Link>
                    )}
                </div>
            </form>



            {types.length > 0 && (
                <nav
                    className={styles.types}
                    aria-label="Категории организаций"
                >
                    <Link
                        href={typeHref("")}
                        className={!selectedType ? styles.activeType : ""}
                    >
                        Все
                    </Link>

                    {types.map((type) => (
                        <Link
                            key={type}
                            href={typeHref(type)}
                            className={
                                selectedType === type ? styles.activeType : ""
                            }
                        >
                            {type}
                        </Link>
                    ))}
                </nav>
            )}



            <section className={styles.listSection}>
                <div className={styles.sectionHeader}>
                    <h2>Все организации</h2>
                    <span>{filteredOrgs.length}</span>
                </div>

                {filteredOrgs.length === 0 ? (
                    <EmptyState
                        title={
                            publishedOrgs.length === 0
                                ? "Организаций пока нет"
                                : "Ничего не найдено"
                        }
                        text={
                            publishedOrgs.length === 0
                                ? "Справочник скоро начнёт наполняться."
                                : "Попробуйте изменить запрос или категорию."
                        }
                    />
                ) : (
                    <div className={styles.orgsGrid}>
                        {filteredOrgs.map((org) => (
                            <Link
                                key={org.slug}
                                href={`/orgs/${org.slug}`}
                                className={styles.orgCard}
                            >
                                <div className={styles.orgType}>
                                    {org.type}
                                </div>

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