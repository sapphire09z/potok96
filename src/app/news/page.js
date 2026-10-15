import Link from "next/link";
import { formatDate } from "@/lib/date";
import EmptyState from "@/components/EmptyState";

import { getAllNews } from "@/lib/news";

import styles from "./news.module.css";
export const metadata = {
    title: "Новости",
    description: "Новости Красноуфимска и района на городском портале Поток 96.",
};
export default async function NewsPage() {
    const news = await getAllNews();

    const publishedNews = news
        .filter((post) => post.status === "published")
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const mainPost = publishedNews[0];
    const otherPosts = publishedNews.slice(1);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>Новости</div>
                <h1>Городская лента</h1>
                <p>
                    События, люди, организации и важные изменения Красноуфимска и района.
                </p>
            </header>

            {mainPost && (
                <section className={styles.featured}>
                    <div className={styles.sectionLabel}>Главное</div>

                    <Link href={`/news/${mainPost.slug}`} className={styles.featuredLink}>
                        <h2>{mainPost.title}</h2>

                        {mainPost.summary && <p>{mainPost.summary}</p>}

                        <div className={styles.meta}>
                            <span>{mainPost.category}</span>
                            <span>•</span>
                            <span>{formatDate(mainPost.date)}</span>
                        </div>
                    </Link>
                </section>
            )}

            <section className={styles.listSection}>
                <div className={styles.sectionHeader}>
                    <h2>Все новости</h2>
                    <span>{publishedNews.length}</span>
                </div>

                {publishedNews.length === 0 ? (
                    <EmptyState
                        title="Новостей пока нет"
                        text="Раздел скоро начнёт наполняться городскими материалами."
                    />
                ) : (
                    <div className={styles.newsList}>
                        {otherPosts.map((post) => (
                            <Link
                                key={post.slug}
                                href={`/news/${post.slug}`}
                                className={styles.newsItem}
                            >
                                <div className={styles.newsText}>
                                    <div className={styles.newsMeta}>
                                        <span>{post.category}</span>
                                        <span>•</span>
                                        <span>{formatDate(post.date)}</span>
                                    </div>

                                    <h3>{post.title}</h3>

                                    {post.summary && <p>{post.summary}</p>}

                                    {post.tags?.length > 0 && (
                                        <div className={styles.tags}>
                                            {post.tags.slice(0, 4).map((tag) => (
                                                <span key={tag}>#{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}