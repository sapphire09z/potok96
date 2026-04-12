import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getEventBySlug } from "@/lib/events";
import styles from "./event-page.module.css";
import Link from "next/link";

export default async function EventItemPage({ params }) {
    const { slug } = await params;
    const event = await getEventBySlug(slug);

    if (!event || event.status !== "published") notFound();

    return (
        <article className={styles.article}>
            <div className={styles.meta}>
                {event.org && (
                    <div>
                        <b>Место:</b>{" "}
                        <Link href={`/orgs/${event.org}`}>
                            {event.org}
                        </Link>
                    </div>
                )}
                <span>{event.startAt}</span>
                {event.location && <span>• {event.location}</span>}
                {event.price && <span>• {event.price}</span>}
            </div>

            <h1 className={styles.title}>{event.title}</h1>

            <div className={styles.content}>
                <ReactMarkdown>{event.content}</ReactMarkdown>
            </div>
        </article>
    );
}
