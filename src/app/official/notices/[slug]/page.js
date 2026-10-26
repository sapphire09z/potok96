
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getOfficialNoticeBySlug } from "@/lib/officialNotices";
import styles from "../notices.module.css";

function formatDate(date) {
    const [y, m, d] = date.split("-");
    return `${d}.${m}.${y}`;
}

function safeExternalUrl(value) {
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol)
            ? url.href
            : null;
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const item = getOfficialNoticeBySlug(slug);

    if (!item) return { title: "Сообщение не найдено" };

    return {
        title: item.title,
        description: item.summary || item.title,
    };
}

export default async function OfficialNoticePage({ params }) {
    const { slug } = await params;
    const item = getOfficialNoticeBySlug(slug);

    if (!item) notFound();

    const sourceUrl = safeExternalUrl(item.sourceUrl);

    return (
        <article className={styles.page}>
            <Link
                href="/official/notices"
                className={styles.back}
            >
                ← Все сообщения
            </Link>

            <header className={styles.header}>
                <p className={styles.eyebrow}>
                    Официальная информация
                </p>

                <h1>{item.title}</h1>

                <div className={styles.meta}>
                    <span>{formatDate(item.date)}</span>
                    {item.issuer && <span>{item.issuer}</span>}
                    {item.locality && <span>{item.locality}</span>}
                </div>
            </header>

            {item.summary && (
                <p className={styles.lead}>{item.summary}</p>
            )}

            <div className={styles.articleBody}>
                <ReactMarkdown>{item.content}</ReactMarkdown>
            </div>

            {sourceUrl && (
                <div className={styles.source}>
                    <span>Источник информации</span>
                    <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Открыть первоисточник ↗
                    </a>
                </div>
            )}
        </article>
    );
}
