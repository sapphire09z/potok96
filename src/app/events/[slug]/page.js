import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { formatDateTime } from "@/lib/date";
import { getEventBySlug } from "@/lib/events";
import { getOrgBySlug } from "@/lib/orgs";
import Image from "next/image";

import styles from "./event.module.css";
export async function generateMetadata({ params }) {
    const { slug } = await params;
    const event = await getEventBySlug(slug);

    if (!event || event.status !== "published") {
        return {
            title: "Событие не найдено",
        };
    }

    return {
        title: event.title,
        description: event.summary || `Событие в афише Поток 96.`,
        openGraph: {
            title: event.title,
            description: event.summary || "Событие в афише Поток 96.",
            type: "article",
        },
    };
}

export default async function EventPage({ params }) {
    const { slug } = await params;

    const event = await getEventBySlug(slug);

    if (!event || event.status !== "published") {
        notFound();
    }

    const org = event.org ? await getOrgBySlug(event.org) : null;

    return (
        <article className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>Афиша</div>

                <h1>{event.title}</h1>

                <div className={`${styles.eventLayout} ${event.cover ? styles.hasPoster : ""}`}>
                    {event.cover && (
                        <div className={styles.eventPoster}>
                            <Image
                                src={event.cover}
                                alt={`Афиша: ${event.title}`}
                                fill
                                sizes="(max-width: 700px) 260px, 260px"
                                className={styles.posterImage}
                            />
                        </div>
                    )}

                    <div className={styles.eventBody}>


                    {event.summary && <p className={styles.lead}>{event.summary}</p>}

                <div className={styles.infoGrid}>
                    {event.startAt && (
                        <div className={styles.infoItem}>
                            <span>Дата и время</span>
                            <strong>{formatDateTime(event.startAt)}</strong>
                        </div>
                    )}

                    {event.location && (
                        <div className={styles.infoItem}>
                            <span>Место</span>
                            <strong>{event.location}</strong>
                        </div>
                    )}

                    {event.price && (
                        <div className={styles.infoItem}>
                            <span>Стоимость</span>
                            <strong>{event.price}</strong>
                        </div>
                    )}
                </div>

                {org && (
                    <div className={styles.orgBox}>
                        <span>Организатор: </span>
                        <Link href={`/orgs/${org.slug}`}>{org.title}</Link>
                    </div>
                )}
                    </div>
                </div>
            </header>

            {event.video && (
                <div className={styles.video}>
                    <iframe
                        src={event.video}
                        title={`Видео: ${event.title}`}
                        loading="lazy"
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            )}


            <section className={styles.content}>
                <ReactMarkdown>{event.content}</ReactMarkdown>
            </section>
        </article>
    );
}