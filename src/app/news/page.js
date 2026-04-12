import Link from "next/link";
import { getAllNews } from "@/lib/news";
import styles from "./news.module.css";

export const metadata = {
    title: "Новости — Поток 96",
    description: "Городские новости Красноуфимска и района.",
};

export default async function NewsListPage() {
    const news = await getAllNews();

    const categories = Array.from(
        new Set(news.map((n) => n.category ?? "город"))
    ).sort((a, b) => a.localeCompare(b, "ru"));

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>Новости</h1>

            {/* Рубрики */}
            <div className={styles.categories}>
                {categories.map((c) => (
                    <Link
                        key={c}
                        href={`/news/category/${encodeURIComponent(c)}`}
                        className={styles.cat}
                    >
                        {c}
                    </Link>
                ))}
            </div>

            <div className={styles.list}>
                {news.map((n) => (
                    <article key={n.slug} className={styles.card}>
                        <div className={styles.meta}>
                            <span>{n.date}</span>
                            {n.category && (
                                <Link
                                    href={`/news/category/${encodeURIComponent(n.category)}`}
                                    className={styles.catPill}
                                >
                                    {n.category}
                                </Link>
                            )}
                        </div>

                        <Link href={`/news/${n.slug}`} className={styles.link}>
                            {n.title}
                        </Link>

                        <div className={styles.summary}>{n.summary}</div>
                    </article>
                ))}
            </div>

            {news.length === 0 && (
                <div className={styles.empty}>Пока нет опубликованных новостей.</div>
            )}
        </div>
    );
}
