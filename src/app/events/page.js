import Link from "next/link";
import { getAllEvents } from "@/lib/events";
import styles from "./events-list.module.css";

export const metadata = {
    title: "Афиша — Поток 96",
    description: "События Красноуфимска и района.",
};

export default async function EventsPage() {
    const events = await getAllEvents();

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>Афиша</h1>

            <div className={styles.list}>
                {events.map((e) => (
                    <article key={e.slug} className={styles.card}>
                        <div className={styles.meta}>
                            <span>{e.startAt}</span>
                            {e.location && <span>• {e.location}</span>}
                            {e.price && <span>• {e.price}</span>}
                        </div>

                        <Link href={`/events/${e.slug}`} className={styles.link}>
                            {e.title}
                        </Link>

                        {e.summary && <div className={styles.summary}>{e.summary}</div>}
                    </article>
                ))}
            </div>

            {events.length === 0 && (
                <div className={styles.empty}>Пока нет опубликованных событий.</div>
            )}
        </div>
    );
}
