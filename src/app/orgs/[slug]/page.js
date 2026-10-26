import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { formatDate, formatDateTime } from "@/lib/date";
import { getAllEvents } from "@/lib/events";
import { getAllNews } from "@/lib/news";
import { getOrgBySlug } from "@/lib/orgs";

import styles from "./org.module.css";
export async function generateMetadata({ params }) {
    const { slug } = await params;
    const org = await getOrgBySlug(slug);

    if (!org || org.status !== "published") {
        return {
            title: "Организация не найдена",
        };
    }

    return {
        title: org.title,
        description: `${org.type || "Организация"} в справочнике Поток 96.`,
        openGraph: {
            title: org.title,
            description: `${org.type || "Организация"} в справочнике Поток 96.`,
            type: "article",
        },
    };
}
export default async function OrgPage({ params }) {
    const { slug } = await params;

    const org = await getOrgBySlug(slug);

    if (!org || org.status !== "published") {
        notFound();
    }

    const phoneNumber = String(org.phone ?? "")
        .replace(/[^\d+]/g, "");

    const phoneHref =
        phoneNumber.replace(/\D/g, "").length >= 7
            ? `tel:${phoneNumber}`
            : null;

    let websiteHref = null;

    try {
        if (org.website) {
            const url = new URL(org.website);

            if (["https:", "http:"].includes(url.protocol)) {
                websiteHref = url.href;
            }
        }
    } catch {
        websiteHref = null;
    }

    const [events, news] = await Promise.all([
        getAllEvents(),
        getAllNews(),
    ]);

    const now = Date.now();

    const relatedEvents = events
        .filter(
            (event) =>
                event.org === org.slug &&
                new Date(event.startAt).getTime() >= now
        )
        .sort(
            (a, b) =>
                new Date(a.startAt).getTime() -
                new Date(b.startAt).getTime()
        );
    const relatedNews = news.filter((post) => post.org === org.slug);

    return (
        <article className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>{org.type}</div>

                <h1>{org.title}</h1>

                <div className={styles.infoGrid}>
                    {org.address && (
                        <div className={styles.infoItem}>
                            <span>Адрес</span>
                            <strong>{org.address}</strong>
                        </div>
                    )}

                    {org.phone && (
                        <div className={styles.infoItem}>
                            <span>Телефон</span>
                            <strong>{org.phone}</strong>
                        </div>
                    )}

                    {org.hours && (
                        <div className={styles.infoItem}>
                            <span>Время работы</span>
                            <strong>{org.hours}</strong>
                        </div>
                    )}
                </div>

                {(phoneHref || websiteHref) && (
                    <div className={styles.actions}>
                        {phoneHref && (
                            <a href={phoneHref} className={styles.primaryAction}>
                                Позвонить
                            </a>
                        )}

                        {websiteHref && (
                            <a
                                href={websiteHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.secondaryAction}
                            >
                                Перейти на сайт ↗
                            </a>
                        )}
                    </div>
                )}

            </header>

            <section className={styles.content}>
                <ReactMarkdown>{org.content}</ReactMarkdown>

                {org.services?.length > 0 && (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2>Услуги и направления</h2>
                            <span>{org.services.length}</span>
                        </div>

                        <div className={styles.servicesGrid}>
                            {org.services.map((service, index) => (
                                <div
                                    key={`${service}-${index}`}
                                    className={styles.serviceItem}
                                >
                                    {service}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

            </section>

            {relatedEvents.length > 0 && (
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Предстоящие мероприятия</h2>
                        <span>{relatedEvents.length}</span>
                    </div>

                    <div className={styles.list}>
                        {relatedEvents.map((event) => (
                            <Link
                                key={event.slug}
                                href={`/events/${event.slug}`}
                                className={styles.listItem}
                            >
                                <div>
                                    <h3>{event.title}</h3>

                                    {event.summary && <p>{event.summary}</p>}
                                </div>

                                {event.startAt && (
                                    <span className={styles.date}>{formatDateTime(event.startAt)}</span>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {relatedNews.length > 0 && (
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Новости организации</h2>
                        <span>{relatedNews.length}</span>
                    </div>

                    <div className={styles.list}>
                        {relatedNews.map((post) => (
                            <Link
                                key={post.slug}
                                href={`/news/${post.slug}`}
                                className={styles.listItem}
                            >
                                <div>
                                    <h3>{post.title}</h3>

                                    {post.summary && <p>{post.summary}</p>}
                                </div>

                                {post.date && (
                                    <span className={styles.date}>{formatDate(post.date)}</span>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}