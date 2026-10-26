import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { formatDate, formatDateTime } from "@/lib/date";
import { getAllEvents } from "@/lib/events";
import { getAllNews } from "@/lib/news";
import { getOrgBySlug } from "@/lib/orgs";
import Image from "next/image";

import styles from "./org.module.css";

function safeExternalLink(value) {
    if (typeof value !== "string") return null;

    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : null;
    } catch {
        return null;
    }
}

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

    const mapHref = safeExternalLink(org.mapUrl);

    const emailHref =
        typeof org.email === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(org.email)
            ? `mailto:${org.email}`
            : null;

    const socialLinks = [
        {
            label: "ВКонтакте",
            href: safeExternalLink(org.socials?.vk),
        },
        {
            label: "Одноклассники",
            href: safeExternalLink(org.socials?.ok),
        },
        {
            label: "MAX",
            href: safeExternalLink(org.socials?.max),
        },
    ].filter((item) => item.href);

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
                {org.cover && (
                    <div className={styles.cover}>
                        <Image
                            src={org.cover}
                            alt={`Фотография организации: ${org.title}`}
                            fill
                            sizes="(max-width: 700px) 100vw, 900px"
                            className={styles.coverImage}
                            priority
                        />
                    </div>
                )}

                <div className={styles.identity}>
                    {org.logo && (
                        <div className={styles.logo}>
                            <Image
                                src={org.logo}
                                alt={`Логотип: ${org.title}`}
                                fill
                                sizes="96px"
                                className={styles.logoImage}
                            />
                        </div>
                    )}

                    <div className={styles.identityText}>
                        <div className={styles.kicker}>{org.type}</div>
                        <h1>{org.title}</h1>
                    </div>
                </div>


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

                {(phoneHref || websiteHref || emailHref || mapHref) && (
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

                        {emailHref && (
                            <a
                                href={emailHref}
                                className={styles.secondaryAction}
                            >
                                Написать на почту
                            </a>
                        )}

                        {mapHref && (
                            <a
                                href={mapHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.secondaryAction}
                            >
                                На карте ↗
                            </a>
                        )}

                    </div>
                )}

                {socialLinks.length > 0 && (
                    <nav
                        className={styles.socialLinks}
                        aria-label="Социальные сети организации"
                    >
                        {socialLinks.map((item) => (
                            <a
                                key={item.label}
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {item.label} ↗
                            </a>
                        ))}
                    </nav>
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

            {org.gallery?.length > 0 && (
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Фотографии</h2>
                        <span>{org.gallery.length}</span>
                    </div>

                    <div className={styles.galleryGrid}>
                        {org.gallery.map((photo, index) => (
                            <a
                                key={`${photo.src}-${index}`}
                                href={photo.src}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.galleryItem}
                                aria-label={`Открыть фотографию: ${photo.alt}`}
                            >
                                <Image
                                    src={photo.src}
                                    alt={photo.alt}
                                    fill
                                    sizes="(max-width: 700px) 50vw, 280px"
                                    className={styles.galleryImage}
                                />
                            </a>
                        ))}
                    </div>
                </section>
            )}

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