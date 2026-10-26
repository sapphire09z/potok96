
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getAllOrgs } from "@/lib/orgs";
import {
    ORG_CATEGORIES,
    getOrgCategoryTitle,
} from "@/lib/orgCategories";

import styles from "./orgs.module.css";

export const metadata = {
    title: "Справочник организаций",
    description:
        "Организации, учреждения, секции и услуги Красноуфимска и района.",
};

export default async function OrgsPage({ searchParams }) {
    const params = await searchParams;

    const q =
        typeof params?.q === "string"
            ? params.q.trim()
            : "";

    const requestedCategory =
        typeof params?.category === "string"
            ? params.category
            : "";

    const category = ORG_CATEGORIES.some(
        (item) => item.id === requestedCategory
    )
        ? requestedCategory
        : "";

    const area =
        params?.area === "city" || params?.area === "district"
            ? params.area
            : "";

    const publishedOrgs = (await getAllOrgs()).sort(
        (a, b) => a.title.localeCompare(b.title, "ru")
    );

    // Показываем только категории, в которых есть организации.
    const categories = ORG_CATEGORIES.filter((item) =>
        publishedOrgs.some((org) => org.category === item.id)
    );

    const hasDistrict = publishedOrgs.some(
        (org) => org.area === "district"
    );

    const normalizedQuery = q.toLocaleLowerCase("ru-RU");

    const filteredOrgs = publishedOrgs.filter((org) => {
        const searchableText = [
            org.title,
            org.type,
            getOrgCategoryTitle(org.category),
            org.address,
            org.locality,
            ...(Array.isArray(org.tags) ? org.tags : []),
            ...(Array.isArray(org.services) ? org.services : []),
        ]
            .join(" ")
            .toLocaleLowerCase("ru-RU");

        return (
            searchableText.includes(normalizedQuery) &&
            (!category || org.category === category) &&
            (!area || org.area === area)
        );
    });

    function filterHref({
                            nextCategory = category,
                            nextArea = area,
                        } = {}) {
        const search = new URLSearchParams();

        if (q) search.set("q", q);
        if (nextCategory) search.set("category", nextCategory);
        if (nextArea) search.set("area", nextArea);

        const query = search.toString();

        return query ? `/orgs?${query}` : "/orgs";
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>Справочник</div>
                <h1>Организации города и района</h1>
                <p>
                    Компании, учреждения, секции, услуги и
                    городские места Красноуфимска и района.
                </p>
            </header>

            <form
                action="/orgs"
                method="get"
                className={styles.searchForm}
            >
                <label
                    htmlFor="org-search"
                    className={styles.searchLabel}
                >
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

                    {category && (
                        <input
                            type="hidden"
                            name="category"
                            value={category}
                        />
                    )}

                    {area && (
                        <input
                            type="hidden"
                            name="area"
                            value={area}
                        />
                    )}

                    <button type="submit">Найти</button>

                    {(q || category || area) && (
                        <Link href="/orgs" className={styles.reset}>
                            Сбросить
                        </Link>
                    )}
                </div>
            </form>

            {categories.length > 0 && (
                <div className={styles.filterGroup}>
                    <div className={styles.filterCaption}>
                        Категории
                    </div>

                    <nav
                        className={styles.types}
                        aria-label="Категории организаций"
                    >
                        <Link
                            href={filterHref({ nextCategory: "" })}
                            className={
                                !category ? styles.activeType : ""
                            }
                        >
                            Все
                        </Link>

                        {categories.map((item) => (
                            <Link
                                key={item.id}
                                href={filterHref({
                                    nextCategory: item.id,
                                })}
                                className={
                                    category === item.id
                                        ? styles.activeType
                                        : ""
                                }
                            >
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}

            {hasDistrict && (
                <div className={styles.filterGroup}>
                    <div className={styles.filterCaption}>
                        Территория
                    </div>

                    <nav
                        className={styles.types}
                        aria-label="Территория"
                    >
                        {[
                            { id: "", title: "Везде" },
                            { id: "city", title: "Красноуфимск" },
                            { id: "district", title: "Район" },
                        ].map((item) => (
                            <Link
                                key={item.id}
                                href={filterHref({
                                    nextArea: item.id,
                                })}
                                className={
                                    area === item.id
                                        ? styles.activeType
                                        : ""
                                }
                            >
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}

            <section className={styles.listSection}>
                <div className={styles.sectionHeader}>
                    <h2>Организации</h2>
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
                                : "Попробуйте изменить запрос или фильтры."
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
                                    {getOrgCategoryTitle(org.category)}
                                </div>

                                <h3>{org.title}</h3>

                                <div className={styles.orgMeta}>
                                    {org.type && <span>{org.type}</span>}

                                    <span className={styles.orgPlace}>
                                        {org.area === "district"
                                            ? org.locality
                                                ? `${org.locality} · район`
                                                : "Район"
                                            : "Красноуфимск"}
                                    </span>
                                </div>

                                <div className={styles.orgInfo}>
                                    {org.address &&
                                        org.address.trim().toLowerCase() !==
                                        org.locality.toLowerCase() && (
                                            <span>{org.address}</span>
                                        )}

                                    {org.phone && (
                                        <span>{org.phone}</span>
                                    )}

                                    {org.hours && (
                                        <span>{org.hours}</span>
                                    )}
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
