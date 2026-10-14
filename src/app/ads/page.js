import Link from "next/link";

import { getAllAds } from "@/lib/ads";

import styles from "./ads.module.css";

export const metadata = {
    title: "Объявления — Поток 96",
    description: "Городские объявления Красноуфимска и района",
};

export default async function AdsPage() {
    const ads = await getAllAds();

    const publishedAds = ads
        .filter((ad) => ad.status === "published")
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const categories = Array.from(
        new Set(publishedAds.map((ad) => ad.category).filter(Boolean))
    );

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>Объявления</div>

                <h1>Городская доска</h1>

                <p>
                    Частные объявления, услуги, вакансии, предложения и полезные находки
                    Красноуфимска и района.
                </p>
            </header>

            {categories.length > 0 && (
                <section className={styles.categories}>
                    {categories.map((category) => (
                        <span key={category}>{category}</span>
                    ))}
                </section>
            )}

            <section className={styles.listSection}>
                <div className={styles.sectionHeader}>
                    <h2>Все объявления</h2>
                    <span>{publishedAds.length}</span>
                </div>

                <div className={styles.adsGrid}>
                    {publishedAds.map((ad) => (
                        <Link key={ad.slug} href={`/ads/${ad.slug}`} className={styles.adCard}>
                            <div className={styles.adCategory}>{ad.category}</div>

                            <h3>{ad.title}</h3>

                            {ad.summary && <p>{ad.summary}</p>}

                            <div className={styles.adDetails}>
                                {ad.price && <span>{ad.price}</span>}
                                {ad.location && <span>{ad.location}</span>}
                                {ad.date && <span>{ad.date}</span>}
                            </div>

                            {ad.tags?.length > 0 && (
                                <div className={styles.tags}>
                                    {ad.tags.slice(0, 4).map((tag) => (
                                        <span key={tag}>#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}