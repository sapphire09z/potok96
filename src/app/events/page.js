import Link from "next/link";
import { formatDateTime } from "@/lib/date";
import { getAllEvents } from "@/lib/events";
import { getAllOrgs } from "@/lib/orgs";
import EmptyState from "@/components/EmptyState";
import Image from "next/image";
export const dynamic = "force-dynamic";

import styles from "./events.module.css";
export const metadata = {
    title: "Афиша",
    description: "Афиша событий, мероприятий и встреч Красноуфимска и района.",
};


function EventCard({ event, org }) {
    return (
        <Link
            href={`/events/${event.slug}`}
            className={`${styles.eventCard} ${event.cover ? styles.withPoster : ""}`}
        >
            <div className={styles.eventDate}>
                {formatDateTime(event.startAt)}
            </div>

            {event.cover && (
                <div className={styles.cardPoster}>
                    <Image
                        src={event.cover}
                        alt={`Афиша: ${event.title}`}
                        fill
                        sizes="(max-width: 700px) 110px, 150px"
                        className={styles.posterImage}
                    />
                </div>
            )}

            <h3>{event.title}</h3>

            {event.summary && <p>{event.summary}</p>}

            <div className={styles.eventDetails}>
                {event.location && <span>{event.location}</span>}
                {event.price && <span>{event.price}</span>}
                {org && <span>{org.title}</span>}
            </div>
        </Link>
    );
}

export default async function EventsPage() {
    const [events, orgs] = await Promise.all([
        getAllEvents(),
        getAllOrgs(),
    ]);
    const orgBySlug = new Map(orgs.map((org) => [org.slug, org]));

    const now = Date.now();

// Предстоящие мероприятия
    const upcomingEvents = events.filter(
        (event) => new Date(event.startAt).getTime() >= now
    );

// Прошедшие мероприятия — сначала самые недавние
    const pastEvents = events
        .filter((event) => new Date(event.startAt).getTime() < now)
        .reverse();

// Ближайшее мероприятие
    const mainEvent = upcomingEvents[0] ?? null;
    const otherEvents = upcomingEvents.slice(1);


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

                        {mainEvent.cover && (
                            <div className={styles.featuredPoster}>
                                <Image
                                    src={mainEvent.cover}
                                    alt={`Афиша: ${mainEvent.title}`}
                                    fill
                                    sizes="(max-width: 700px) 220px, 260px"
                                    className={styles.posterImage}
                                />
                            </div>
                        )}

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


            {/* Нет предстоящих событий */}
            {!mainEvent && (
                <EmptyState
                    title="Предстоящих мероприятий пока нет"
                    text="Следите за обновлениями городской афиши."
                />
            )}

            {/* Другие предстоящие мероприятия */}
            {otherEvents.length > 0 && (
                <section className={styles.listSection}>
                    <div className={styles.sectionHeader}>
                        <h2>Другие предстоящие события</h2>
                        <span>{otherEvents.length}</span>
                    </div>

                    <div className={styles.eventsGrid}>
                        {otherEvents.map((event) => (
                            <EventCard
                                key={event.slug}
                                event={event}
                                org={event.org ? orgBySlug.get(event.org) : null}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Архив мероприятий */}
            {pastEvents.length > 0 && (
                <section className={styles.listSection}>
                    <div className={styles.sectionHeader}>
                        <h2>Прошедшие мероприятия</h2>
                        <span>{pastEvents.length}</span>
                    </div>

                    <div className={styles.eventsGrid}>
                        {pastEvents.map((event) => (
                            <EventCard
                                key={event.slug}
                                event={event}
                                org={event.org ? orgBySlug.get(event.org) : null}
                            />
                        ))}
                    </div>
                </section>
            )}

        </div>
    );
}