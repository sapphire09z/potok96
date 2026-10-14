import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { getAdBySlug } from "@/lib/ads";

import styles from "./ad.module.css";

export default async function AdPage({ params }) {
    const { slug } = await params;

    const ad = await getAdBySlug(slug);

    if (!ad || ad.status !== "published") {
        notFound();
    }

    return (
        <article className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>{ad.category}</div>

                <h1>{ad.title}</h1>

                {ad.summary && <p className={styles.lead}>{ad.summary}</p>}

                <div className={styles.infoGrid}>
                    {ad.price && (
                        <div className={styles.infoItem}>
                            <span>Цена</span>
                            <strong>{ad.price}</strong>
                        </div>
                    )}

                    {ad.location && (
                        <div className={styles.infoItem}>
                            <span>Место</span>
                            <strong>{ad.location}</strong>
                        </div>
                    )}

                    {ad.contact && (
                        <div className={styles.infoItem}>
                            <span>Контакт</span>
                            <strong>{ad.contact}</strong>
                        </div>
                    )}
                </div>
            </header>

            <section className={styles.content}>
                <ReactMarkdown>{ad.content}</ReactMarkdown>
            </section>

            {ad.tags?.length > 0 && (
                <section className={styles.tags}>
                    {ad.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                    ))}
                </section>
            )}
        </article>
    );
}