
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { getAllAds } from "@/lib/ads";
import {
    AD_CATEGORIES,
    getAdCategoryTitle,
} from "@/lib/adCategories";
import EmptyState from "@/components/EmptyState";

import styles from "./ads.module.css";

export const metadata = {
    title: "Объявления",
    description:
        "Частные объявления Красноуфимска и района: товары, услуги, недвижимость и вакансии.",
};

export default async function AdsPage({ searchParams }) {
    const params = await searchParams;

    const q = typeof params?.q === "string"
        ? params.q.trim().slice(0, 120)
        : "";

    const requestedCategory =
        typeof params?.category === "string"
            ? params.category
            : "";

    const selectedCategory = AD_CATEGORIES.some(
        (item) => item.id === requestedCategory
    )
        ? requestedCategory
        : "";

    const ads = await getAllAds();

    const publishedAds = ads
        .filter((ad) => ad.status === "published")
        .sort(
            (a, b) =>
                new Date(b.date).getTime() -
                new Date(a.date).getTime()
        );

    const categories = AD_CATEGORIES.filter((item) =>
        publishedAds.some((ad) => ad.category === item.id)
    );

    const normalizedQuery = q.toLocaleLowerCase("ru-RU");

    const filteredAds = publishedAds.filter((ad) => {
        const searchableText = [
            ad.title,
            ad.summary,
            ad.content,
            ad.location,
            getAdCategoryTitle(ad.category),
            ...(ad.tags ?? []),
        ]
            .join(" ")
            .toLocaleLowerCase("ru-RU");

        return (
            searchableText.includes(normalizedQuery) &&
            (!selectedCategory ||
                ad.category === selectedCategory)
        );
    });

    function categoryHref(category) {
        const search = new URLSearchParams();

        if (q) search.set("q", q);
        if (category) search.set("category", category);

        const query = search.toString();

        return query ? `/ads?${query}` : "/ads";
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>
                    Объявления
                </div>

                <h1>Городская доска</h1>

                <p>
                    Частные объявления, услуги, вакансии,
                    предложения и полезные находки
                    Красноуфимска и района.
                </p>
            </header>

            <form
                action="/ads"
                method="get"
                className={styles.searchForm}
            >
                <label
                    htmlFor="ads-search"
                    className={styles.searchLabel}
                >
                    Поиск объявлений
                </label>

                <div className={styles.searchRow}>
                    <input
                        id="ads-search"
                        type="search"
                        name="q"
                        defaultValue={q}
                        placeholder="Что ищете?"
                        maxLength={120}
                    />

                    {selectedCategory && (
                        <input
                            type="hidden"
                            name="category"
                            value={selectedCategory}
                        />
                    )}

                    <button type="submit">
                        Найти
                    </button>

                    {(q || selectedCategory) && (
                        <Link
                            href="/ads"
                            className={styles.reset}
                        >
                            Сбросить
                        </Link>
                    )}
                </div>
            </form>

            {categories.length > 0 && (
                <nav
                    className={styles.categories}
                    aria-label="Категории объявлений"
                >
                    <Link
                        href={categoryHref("")}
                        className={
                            !selectedCategory
                                ? styles.activeCategory
                                : ""
                        }
                    >
                        Все объявления
                    </Link>

                    {categories.map((item) => (
                        <Link
                            key={item.id}
                            href={categoryHref(item.id)}
                            className={
                                selectedCategory === item.id
                                    ? styles.activeCategory
                                    : ""
                            }
                        >
                            {item.title}
                        </Link>
                    ))}
                </nav>
            )}

            <section className={styles.listSection}>
                <div className={styles.sectionHeader}>
                    <h2>Объявления</h2>
                    <span>{filteredAds.length}</span>
                </div>

                {filteredAds.length === 0 ? (
                    <EmptyState
                        title={
                            publishedAds.length === 0
                                ? "Объявлений пока нет"
                                : "Ничего не найдено"
                        }
                        text={
                            publishedAds.length === 0
                                ? "Раздел находится на этапе наполнения."
                                : "Попробуйте изменить запрос или категорию."
                        }
                    />
                ) : (
                    <div className={styles.adsGrid}>
                        {filteredAds.map((ad) => (
                            <Link
                                key={ad.slug}
                                href={`/ads/${ad.slug}`}
                                className={styles.adCard}
                            >
                                <div className={styles.adCategory}>
                                    {getAdCategoryTitle(ad.category)}
                                </div>

                                <h3>{ad.title}</h3>

                                {ad.summary && <p>{ad.summary}</p>}

                                <div className={styles.adDetails}>
                                    {ad.price && (
                                        <span>{ad.price}</span>
                                    )}

                                    {ad.location && (
                                        <span>{ad.location}</span>
                                    )}

                                    {ad.date && (
                                        <span>{formatDate(ad.date)}</span>
                                    )}
                                </div>

                                {ad.tags?.length > 0 && (
                                    <div className={styles.tags}>
                                        {ad.tags.slice(0, 4).map((tag) => (
                                            <span key={tag}>
                                                #{tag}
                                            </span>
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
