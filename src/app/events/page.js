import Link from "next/link";
import { formatDateTime } from "@/lib/date";
import { getAllEvents } from "@/lib/events";
import { getAllOrgs } from "@/lib/orgs";
import EmptyState from "@/components/EmptyState";

import styles from "./events.module.css";


export default async function EventsPage() {
    const [events, orgs] = await Promise.all([
        getAllEvents(),
        getAllOrgs(),
    ]);

    const orgBySlug = new Map(orgs.map((org) => [org.slug, org]));

    const publishedEvents = events
        .filter((event) => event.status === "published")
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

    const mainEvent = publishedEvents[0];
    const otherEvents = publishedEvents.slice(1);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>Афиша</div>
                <h1>Куда сходить</h1>
                <p>
                    События, встречи, концерты, турниры и городские мероприятия
                    Красноуфимска и района.
                </p>
            </header>

            {mainEvent && (
                <section className={styles.featured}>
                    <div className={styles.sectionLabel}>Ближайшее событие</div>

                    <Link
                        href={`/events/${mainEvent.slug}`}
                        className={styles.featuredLink}
                    >
                        <h2>{mainEvent.title}</h2>

                        {mainEvent.summary && <p>{mainEvent.summary}</p>}

                        <div className={styles.meta}>
                            {mainEvent.startAt && (
                                <span>{formatDateTime(mainEvent.startAt)}</span>
                            )}

                            {mainEvent.location && (
                                <>
                                    <span>•</span>
                                    <span>{mainEvent.location}</span>
                                </>
                            )}

                            {mainEvent.price && (
                                <>
                                    <span>•</span>
                                    <span>{mainEvent.price}</span>
                                </>
                            )}
                        </div>
                    </Link>
                </section>
            )}

            <section className={styles.listSection}>
                <div className={styles.sectionHeader}>
                    <h2>Все события</h2>
                    <span>{publishedEvents.length}</span>
                </div>

                {publishedEvents.length === 0 ? (
                    <EmptyState
                        title="Событий пока нет"
                        text="Скоро здесь появятся мероприятия, встречи и городская афиша."
                    />
                ) : (
                    <div className={styles.eventsGrid}>
                        {otherEvents.map((event) => {
                            const org = event.org ? orgBySlug.get(event.org) : null;

                            return (
                                <Link
                                    key={event.slug}
                                    href={`/events/${event.slug}`}
                                    className={styles.eventCard}
                                >
                                    <div className={styles.eventDate}>
                                        {formatDateTime(event.startAt)}
                                    </div>

                                    <h3>{event.title}</h3>

                                    {event.summary && <p>{event.summary}</p>}

                                    <div className={styles.eventDetails}>
                                        {event.location && <span>{event.location}</span>}
                                        {event.price && <span>{event.price}</span>}
                                        {org && <span>{org.title}</span>}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}