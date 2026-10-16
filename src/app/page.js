import Link from "next/link";

import { getAllNews } from "@/lib/news";
import { getAllEvents } from "@/lib/events";
import { getAllOrgs } from "@/lib/orgs";
import { formatDate, formatDateTime } from "@/lib/date";
import styles from "./home.module.css";
import Image from "next/image";
export const dynamic = "force-dynamic";
import FeaturedStories from "@/components/FeaturedStories";
import { getCurrentAlerts } from "@/lib/alerts";
import CityAlerts from "@/components/CityAlerts";
export default async function HomePage() {
    const [news, events, orgs, alerts] = await Promise.all([
        getAllNews(),
        getAllEvents(),
        getAllOrgs(),
        getCurrentAlerts(),
    ]);


    const publishedNews = news
        .filter((post) => post.status === "published")
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const pinnedNews = publishedNews
        .filter((post) => post.featured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder);

    const regularNews = publishedNews.filter(
        (post) => !post.featured
    );

    const featuredPosts = [
        ...pinnedNews,
        ...regularNews,
    ].slice(0, 3);

    const featuredSlugs = new Set(
        featuredPosts.map((post) => post.slug)
    );

// Новости, которые не вошли в карусель
    const otherNews = publishedNews
        .filter((post) => !featuredSlugs.has(post.slug))
        .slice(0, 5);

    const now = Date.now();

    const publishedEvents = events
        .filter((event) => event.status === "published")
        .filter((event) => {
            const start = new Date(event.startAt).getTime();
            return Number.isFinite(start) && start >= now;
        })
        .slice(0, 4);

    const publishedOrgs = orgs
        .filter((org) => org.status === "published")
        .slice(0, 5);

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
                    {alerts.length > 0 && (
                        <div className={styles.mobileAlerts}>
                            <CityAlerts alerts={alerts} limit={1} />
                        </div>
                    )}
                    {featuredPosts.length > 0 && (
                        <section className={styles.mainStory}>
                            <div className={styles.sectionLabel}>Главное</div>

                            <FeaturedStories stories={featuredPosts} />
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
                                    className={`${styles.newsItem} ${post.cover ? styles.newsWithImage : ""}`}
                                >
                                    {post.cover && (
                                        <div className={styles.newsThumbnail}>
                                            <Image
                                                src={post.cover}
                                                alt={post.title}
                                                fill
                                                sizes="(max-width: 700px) 100px, 140px"
                                                className={styles.coverImage}
                                            />
                                        </div>
                                    )}

                                    <div className={styles.newsBody}>
                                        <div className={styles.newsTitle}>
                                            {post.title}
                                        </div>

                                        {post.summary && (
                                            <div className={styles.newsSummary}>
                                                {post.summary}
                                            </div>
                                        )}

                                        <div className={styles.meta}>
                                            <span>{post.category}</span>
                                            <span>•</span>
                                            <span>{formatDate(post.date)}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}

                        </div>
                    </section>
                </main>

                <aside className={styles.sidebar}>
                    {alerts.length > 0 && (
                        <div className={styles.desktopAlerts}>
                            <CityAlerts alerts={alerts} limit={2} />
                        </div>
                    )}
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
                                        <div className={styles.sideMeta}>{formatDateTime(event.startAt)}</div>
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