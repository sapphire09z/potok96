
import Link from "next/link";
import Image from "next/image";
import { getAllMovies } from "@/lib/movies";

import styles from "./cinema.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Киноафиша",
    description:
        "Фильмы и расписание киносеансов в Красноуфимске. Время сеансов, стоимость билетов и Пушкинская карта.",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Yekaterinburg",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Yekaterinburg",
});

export default async function CinemaPage() {
    const movies = await getAllMovies();
    const now = Date.now();

    const currentMovies = movies
        .map((movie) => ({
            ...movie,
            screenings: movie.screenings
                .filter(
                    (item) =>
                        new Date(item.startAt).getTime() >= now
                )
                .sort(
                    (a, b) =>
                        new Date(a.startAt).getTime() -
                        new Date(b.startAt).getTime()
                ),
        }))
        .filter((movie) => movie.screenings.length > 0)
        .sort(
            (a, b) =>
                new Date(a.screenings[0].startAt).getTime() -
                new Date(b.screenings[0].startAt).getTime()
        );

    return (
        <div className={styles.page}>
            <Link href="/events" className={styles.back}>
                ← Вся афиша
            </Link>

            <header className={styles.header}>
                <div className={styles.kicker}>Афиша / Кино</div>
                <h1>Сейчас в кино</h1>
                <p>
                    Фильмы, ближайшие сеансы и информация
                    о покупке билетов в Красноуфимске.
                </p>
            </header>

            {currentMovies.length === 0 ? (
                <div className={styles.empty}>
                    <h2>Расписание пока не опубликовано</h2>
                    <p>
                        Актуальные киносеансы появятся здесь
                        после заполнения репертуара.
                    </p>
                </div>
            ) : (
                <section className={styles.movies}>
                    {currentMovies.map((movie) => (
                        <article
                            key={movie.slug}
                            className={styles.movieCard}
                        >
                            <div className={styles.poster}>
                                {movie.poster ? (
                                    <Image
                                        src={movie.poster}
                                        alt={`Постер фильма ${movie.title}`}
                                        fill
                                        sizes="(max-width: 700px) 120px, 180px"
                                        className={styles.posterImage}
                                    />
                                ) : (
                                    <div className={styles.placeholder}>
                                        Кино
                                    </div>
                                )}
                            </div>

                            <div className={styles.movieBody}>
                                <div className={styles.movieInfo}>
                                    <h2>{movie.title}</h2>

                                    <div className={styles.meta}>
                                        {movie.genre && (
                                            <span>{movie.genre}</span>
                                        )}

                                        {movie.durationMinutes && (
                                            <span>
                                                {movie.durationMinutes} мин
                                            </span>
                                        )}

                                        {movie.ageRating && (
                                            <span>
                                                {movie.ageRating}
                                            </span>
                                        )}
                                    </div>

                                    {movie.summary && (
                                        <p>{movie.summary}</p>
                                    )}
                                </div>

                                <div className={styles.schedule}>
                                    <h3>Ближайшие сеансы</h3>

                                    {movie.screenings
                                        .slice(0, 12)
                                        .map((screening, index) => (
                                            <div
                                                key={`${screening.startAt}-${index}`}
                                                className={styles.session}
                                            >
                                                <div className={styles.sessionTime}>
                                                    <span>
                                                        {dateFormatter.format(
                                                            new Date(screening.startAt)
                                                        )}
                                                    </span>
                                                    <strong>
                                                        {timeFormatter.format(
                                                            new Date(screening.startAt)
                                                        )}
                                                    </strong>
                                                </div>

                                                <div className={styles.sessionDetails}>
                                                    <span>
                                                        {screening.price !== null
                                                            ? `${screening.price} ₽`
                                                            : "Цена уточняется"}
                                                    </span>

                                                    {screening.pushkinCard && (
                                                        <span className={styles.pushkin}>
                                                            Пушкинская карта
                                                        </span>
                                                    )}
                                                </div>

                                                {screening.ticketUrl ? (
                                                    <a
                                                        href={screening.ticketUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={styles.buyButton}
                                                    >
                                                        Билеты ↗
                                                    </a>
                                                ) : (
                                                    <span className={styles.noLink}>
                                                        Ссылка на билеты уточняется
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </div>
    );
}
