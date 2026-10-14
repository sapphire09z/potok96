import Link from "next/link";

import { getAllNews } from "@/lib/news";
import { getAllEvents } from "@/lib/events";
import { getAllOrgs } from "@/lib/orgs";

import styles from "./home.module.css";

export default async function HomePage() {
    const [news, events, orgs] = await Promise.all([
        getAllNews(),
        getAllEvents(),
        getAllOrgs(),
    ]);

    const publishedNews = news
        .filter((post) => post.status === "published")
        .slice(0, 6);

    const publishedEvents = events
        .filter((event) => event.status === "published")
        .slice(0, 4);

    const publishedOrgs = orgs
        .filter((org) => org.status === "published")
        .slice(0, 5);

    const mainPost = publishedNews[0];
    const otherNews = publishedNews.slice(1);

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div>
                    <div className={styles.kicker}>Городской портал</div>
                    <h1 className={styles.heroTitle}>Поток 96</h1>
                    <p className={styles.heroText}>
                        Новости, события, организации и городские объявления Красноуфимска
                        и района.
                    </p>
                </div>
            </section>

            <div className={styles.layout}>
                <main className={styles.main}>
                    {mainPost && (
                        <section className={styles.mainStory}>
                            <div className={styles.sectionLabel}>Главное</div>

                            <Link href={`/news/${mainPost.slug}`} className={styles.mainStoryLink}>
                                <h2>{mainPost.title}</h2>

                                {mainPost.summary && <p>{mainPost.summary}</p>}

                                <div className={styles.meta}>
                                    <span>{mainPost.category}</span>
                                    <span>•</span>
                                    <span>{mainPost.date}</span>
                                </div>
                            </Link>
                        </section>
                    )}

                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2>Последние новости</h2>
                            <Link href="/news">Все новости</Link>
                        </div>

                        <div className={styles.newsList}>
                            {otherNews.map((post) => (
                                <Link
                                    key={post.slug}
                                    href={`/news/${post.slug}`}
                                    className={styles.newsItem}
                                >
                                    <div className={styles.newsTitle}>{post.title}</div>

                                    {post.summary && (
                                        <div className={styles.newsSummary}>{post.summary}</div>
                                    )}

                                    <div className={styles.meta}>
                                        <span>{post.category}</span>
                                        <span>•</span>
                                        <span>{post.date}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                </main>

                <aside className={styles.sidebar}>
                    <section className={styles.sideBlock}>
                        <div className={styles.sectionHeader}>
                            <h2>Афиша</h2>
                            <Link href="/events">Все</Link>
                        </div>

                        <div className={styles.sideList}>
                            {publishedEvents.map((event) => (
                                <Link
                                    key={event.slug}
                                    href={`/events/${event.slug}`}
                                    className={styles.sideItem}
                                >
                                    <div className={styles.sideTitle}>{event.title}</div>

                                    {event.startAt && (
                                        <div className={styles.sideMeta}>{event.startAt}</div>
                                    )}

                                    {event.location && (
                                        <div className={styles.sideMeta}>{event.location}</div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </section>

                    <section className={styles.sideBlock}>
                        <div className={styles.sectionHeader}>
                            <h2>Организации</h2>
                            <Link href="/orgs">Все</Link>
                        </div>

                        <div className={styles.sideList}>
                            {publishedOrgs.map((org) => (
                                <Link
                                    key={org.slug}
                                    href={`/orgs/${org.slug}`}
                                    className={styles.sideItem}
                                >
                                    <div className={styles.sideTitle}>{org.title}</div>

                                    {org.type && (
                                        <div className={styles.sideMeta}>{org.type}</div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </section>

                    <section className={styles.adBox}>
                        <div className={styles.sectionLabel}>Скоро</div>
                        <h2>Объявления</h2>
                        <p>
                            Раздел для частных объявлений, услуг, вакансий и городских
                            предложений.
                        </p>
                    </section>
                </aside>
            </div>
        </div>
    );
}