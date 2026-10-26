
import Link from "next/link";
import { getAllOfficialNotices } from "@/lib/officialNotices";
import styles from "./notices.module.css";

export const metadata = {
    title: "Сообщения администрации и ведомств",
    description:
        "Информационные сообщения администрации, учреждений и ведомств Красноуфимска и района.",
};

function getParam(value) {
    if (Array.isArray(value)) return value[0] ?? "";
    return typeof value === "string" ? value : "";
}

function formatDate(date) {
    const [y, m, d] = date.split("-");
    return `${d}.${m}.${y}`;
}

export default async function OfficialNoticesPage({
                                                      searchParams,
                                                  }) {
    const params = await searchParams;
    const query = getParam(params?.q).trim();
    const issuer = getParam(params?.issuer);

    const allNotices = getAllOfficialNotices();

    const issuers = [
        ...new Set(allNotices.map((item) => item.issuer)),
    ]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru"));

    const q = query.toLocaleLowerCase("ru-RU");

    const notices = allNotices.filter((item) => {
        const text = [
            item.title,
            item.summary,
            item.issuer,
            item.locality,
            item.content,
        ]
            .join(" ")
            .toLocaleLowerCase("ru-RU");

        return (
            text.includes(q) &&
            (!issuer || item.issuer === issuer)
        );
    });

    return (
        <div className={styles.page}>
            <Link href="/official" className={styles.back}>
                ← Официальная информация
            </Link>

            <header className={styles.header}>
                <p className={styles.eyebrow}>
                    Официально / Сообщения
                </p>
                <h1>Сообщения администрации и ведомств</h1>
                <p>
                    Уведомления, разъяснения и другая информация
                    органов власти и учреждений Красноуфимска
                    и района.
                </p>
            </header>

            <form
                action="/official/notices"
                method="get"
                className={styles.filters}
            >
                <label>
                    <span>Поиск</span>
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Поиск по сообщениям..."
                    />
                </label>

                <label>
                    <span>Ведомство</span>
                    <select name="issuer" defaultValue={issuer}>
                        <option value="">Все ведомства</option>
                        {issuers.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className={styles.actions}>
                    <button type="submit">Найти</button>
                    <Link href="/official/notices">Сбросить</Link>
                </div>
            </form>

            <div className={styles.resultsHead}>
                <h2>Публикации</h2>
                <span>Найдено: {notices.length}</span>
            </div>

            {notices.length === 0 ? (
                <div className={styles.empty}>
                    <h3>
                        {allNotices.length === 0
                            ? "Сообщений пока нет"
                            : "Ничего не найдено"}
                    </h3>
                    <p>
                        {allNotices.length === 0
                            ? "Раздел находится на этапе наполнения."
                            : "Попробуйте изменить поисковый запрос."}
                    </p>
                </div>
            ) : (
                <div className={styles.list}>
                    {notices.map((item) => (
                        <article
                            key={item.slug}
                            className={styles.card}
                        >
                            <div className={styles.meta}>
                                <span>{formatDate(item.date)}</span>
                                {item.issuer && (
                                    <span>{item.issuer}</span>
                                )}
                                {item.locality && (
                                    <span>{item.locality}</span>
                                )}
                            </div>

                            <h3>
                                <Link href={`/official/notices/${item.slug}`}>
                                    {item.title}
                                </Link>
                            </h3>

                            {item.summary && <p>{item.summary}</p>}

                            <Link
                                href={`/official/notices/${item.slug}`}
                                className={styles.readMore}
                            >
                                Читать сообщение →
                            </Link>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
