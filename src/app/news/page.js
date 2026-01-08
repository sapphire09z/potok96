import Link from "next/link";
import { getAllNews } from "@/lib/news";
import styles from "./news.module.css";

export const metadata = {
    title: "Новости — Поток 96",
    description: "Городские новости Красноуфимска и района.",
};

export default async function NewsListPage() {
    const news = await getAllNews();

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>Новости</h1>

            <div className={styles.list}>
                {news.map((n) => (
                    <article key={n.slug} className={styles.card}>
                        <div className={styles.meta}>{n.date}</div>

                        <Link href={`/news/${n.slug}`} className={styles.link}>
                            {n.title}
                        </Link>

                        <div className={styles.summary}>{n.summary}</div>
                    </article>
                ))}
            </div>

            {news.length === 0 && (
                <div className={styles.empty}>
                    Пока нет опубликованных новостей (status: published).
                </div>
            )}
        </div>
    );
}