import Link from "next/link";
import { formatDateTime } from "@/lib/date";
import { getAllEvents } from "@/lib/events";
import { getAllOrgs } from "@/lib/orgs";
import EmptyState from "@/components/EmptyState";
import Image from "next/image";
export const dynamic = "force-dynamic";
import {
    EVENT_CATEGORIES,
    getEventCategoryTitle,
} from "@/lib/eventCategories";

import styles from "./events.module.css";
export const metadata = {
    title: "Афиша",
    description: "Афиша событий, мероприятий и встреч Красноуфимска и района.",
};


function EventCard({ event, org }) {
    return (
        <Link
            href={`/events/${event.slug}`}
            className={`${styles.eventCard} ${styles.withPoster}`}
        >
            <div className={styles.eventDate}>
                {formatDateTime(event.startAt)}
            </div>


            <div className={styles.cardPoster}>
                {event.cover ? (
                    <Image
                        src={event.cover}
                        alt={`Афиша: ${event.title}`}
                        fill
                        sizes="(max-width: 700px) 110px, 150px"
                        className={styles.posterImage}
                    />
                ) : (
                    <div className={styles.posterPlaceholder}>
                        <span>Поток 96</span>
                        <strong>Афиша</strong>
                    </div>
                )}
            </div>


            <h3>{event.title}</h3>

            {event.summary && <p>{event.summary}</p>}

            <div className={styles.eventDetails}>
                <span>{getEventCategoryTitle(event.category)}</span>
                {event.location && <span>{event.location}</span>}
                {event.price && <span>{event.price}</span>}
                {event.pushkinCard && (
                    <span className={styles.pushkinBadge}>
        Пушкинская карта
    </span>
                )}
                {org && <span>{org.title}</span>}
            </div>
        </Link>
    );
}

const YEKAT_OFFSET = 5 * 60 * 60 * 1000;

function getLocalDate(value) {
    const timestamp = new Date(value).getTime();

    if (!Number.isFinite(timestamp)) return "";

    return new Date(timestamp + YEKAT_OFFSET)
        .toISOString()
        .slice(0, 10);
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}


export default async function EventsPage({ searchParams }) {
    const params = await searchParams;

    const selectedDate = ["today", "tomorrow", "weekend"]
        .includes(params?.date)
        ? params.date
        : "all";

    const onlyFree = params?.free === "1";
    const onlyPushkin = params?.pushkin === "1";
    const requestedCategory =
        typeof params?.category === "string"
            ? params.category
            : "";

    const selectedCategory = EVENT_CATEGORIES.some(
        (item) => item.id === requestedCategory
    )
        ? requestedCategory
        : "";

    const [events, orgs] = await Promise.all([
        getAllEvents(),
        getAllOrgs(),
    ]);

    const orgBySlug = new Map(
        orgs.map((org) => [org.slug, org])
    );

    const now = Date.now();
    const today = getLocalDate(now);
    const tomorrow = addDays(today, 1);

    const dayOfWeek = new Date(
        `${today}T00:00:00Z`
    ).getUTCDay();

    const daysToSaturday =
        dayOfWeek === 0
            ? -1
            : (6 - dayOfWeek + 7) % 7;

    const saturday = addDays(today, daysToSaturday);
    const sunday = addDays(saturday, 1);

    const upcomingEvents = events.filter(
        (event) =>
            new Date(event.startAt).getTime() >= now
    );

    const pastEvents = events
        .filter(
            (event) =>
                new Date(event.startAt).getTime() < now
        )
        .reverse();

    const filteredEvents = upcomingEvents.filter((event) => {
        const eventDate = getLocalDate(event.startAt);

        const matchesDate =
            selectedDate === "all" ||
            (selectedDate === "today" && eventDate === today) ||
            (selectedDate === "tomorrow" && eventDate === tomorrow) ||
            (
                selectedDate === "weekend" &&
                (eventDate === saturday || eventDate === sunday)
            );

        return (
            matchesDate &&
            (!selectedCategory || event.category === selectedCategory) &&
            (!onlyFree || event.isFree) &&
            (!onlyPushkin || event.pushkinCard)
        );
    });

    const mainEvent = filteredEvents[0] ?? null;
    const otherEvents = filteredEvents.slice(1);

    const hasFilters =
        selectedDate !== "all" ||
        Boolean(selectedCategory) ||
        onlyFree ||
        onlyPushkin;

    function filterHref({
                            date = selectedDate,
                            category = selectedCategory,
                            free = onlyFree,
                            pushkin = onlyPushkin,
                        } = {}) {
        const search = new URLSearchParams();

        if (category) search.set("category", category);
        if (date !== "all") search.set("date", date);
        if (free) search.set("free", "1");
        if (pushkin) search.set("pushkin", "1");

        const query = search.toString();

        return query ? `/events?${query}` : "/events";
    }


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

            <section className={styles.filters} aria-label="Фильтры афиши">
                <div className={styles.filterGroup}>

                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>
                            Категории мероприятий
                        </div>

                        <nav
                            className={styles.filterLinks}
                            aria-label="Категории мероприятий"
                        >
                            <Link
                                href={filterHref({ category: "" })}
                                className={`${styles.filterChip} ${
                                    !selectedCategory ? styles.activeFilter : ""
                                }`}
                            >
                                Все события
                            </Link>


                            <Link
                                href="/events/cinema"
                                className={styles.filterChip}
                            >
                                Кино
                            </Link>

                            {EVENT_CATEGORIES
                                .filter((item) => item.id !== "cinema")
                                .map((item) => (
                                    <Link
                                        key={item.id}
                                        href={filterHref({ category: item.id })}
                                        className={`${styles.filterChip} ${
                                            selectedCategory === item.id
                                                ? styles.activeFilter
                                                : ""
                                        }`}
                                    >
                                        {item.title}
                                    </Link>
                                ))}

                        </nav>
                    </div>

                    <div className={styles.filterLabel}>Когда</div>

                    <nav className={styles.filterLinks} aria-label="Выбор даты">
                        {[
                            { id: "all", label: "Все предстоящие" },
                            { id: "today", label: "Сегодня" },
                            { id: "tomorrow", label: "Завтра" },
                            { id: "weekend", label: "Выходные" },
                        ].map((item) => (
                            <Link
                                key={item.id}
                                href={
                                    item.id === "cinema"
                                        ? "/events/cinema"
                                        : filterHref({ category: item.id })
                                }
                                className={`${styles.filterChip} ${
                                    selectedDate === item.id
                                        ? styles.activeFilter
                                        : ""
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>Дополнительно</div>

                    <nav
                        className={styles.filterLinks}
                        aria-label="Дополнительные условия"
                    >
                        <Link
                            href={filterHref({ free: !onlyFree })}
                            className={`${styles.filterChip} ${
                                onlyFree ? styles.activeFilter : ""
                            }`}
                        >
                            Бесплатно
                        </Link>

                        <Link
                            href={filterHref({ pushkin: !onlyPushkin })}
                            className={`${styles.filterChip} ${
                                onlyPushkin ? styles.activeFilter : ""
                            }`}
                        >
                            Пушкинская карта
                        </Link>

                        {hasFilters && (
                            <Link href="/events" className={styles.clearFilters}>
                                Сбросить фильтры
                            </Link>
                        )}
                    </nav>
                </div>
            </section>

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
                            <span>{getEventCategoryTitle(mainEvent.category)}</span>
                            {mainEvent.pushkinCard && (
                                <span className={styles.pushkinBadge}>
                                    Пушкинская карта
                                </span>
                            )}
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
                    title={
                        hasFilters
                            ? "По выбранным условиям событий не найдено"
                            : "Предстоящих мероприятий пока нет"
                    }
                    text={
                        hasFilters
                            ? "Попробуйте изменить или сбросить фильтры."
                            : "Следите за обновлениями городской афиши."
                    }
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
            {!hasFilters && pastEvents.length > 0 && (
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