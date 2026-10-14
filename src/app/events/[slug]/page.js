import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { getEventBySlug } from "@/lib/events";
import { getOrgBySlug } from "@/lib/orgs";

import styles from "./event.module.css";

function formatEventDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
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

                {event.summary && <p className={styles.lead}>{event.summary}</p>}

                <div className={styles.infoGrid}>
                    {event.startAt && (
                        <div className={styles.infoItem}>
                            <span>Дата и время</span>
                            <strong>{formatEventDate(event.startAt)}</strong>
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
            </header>

            <section className={styles.content}>
                <ReactMarkdown>{event.content}</ReactMarkdown>
            </section>
        </article>
    );
}