
import Link from "next/link";
import { getAllOfficialDocuments } from "@/lib/officialDocuments";
import styles from "./documents.module.css";

export const metadata = {
    title: "Нормативные правовые акты",
    description:
        "Реестр нормативных правовых актов Красноуфимска. Поиск по номеру, названию, дате и принявшему органу.",
};

function getParam(value) {
    if (Array.isArray(value)) return value[0] ?? "";
    return typeof value === "string" ? value : "";
}

function formatDate(value) {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
}

function isSafeLink(value) {
    return (
        /^https?:\/\//i.test(value) ||
        /^\/(?!\/)/.test(value)
    );
}

export default async function DocumentsPage({ searchParams }) {
    const params = await searchParams;

    const query = getParam(params.q).trim();
    const type = getParam(params.type);
    const year = getParam(params.year);

    const allDocuments = getAllOfficialDocuments();

    const types = [...new Set(allDocuments.map((doc) => doc.type))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru"));

    const years = [...new Set(
        allDocuments.map((doc) => doc.date.slice(0, 4))
    )].sort((a, b) => b.localeCompare(a));

    const normalizedQuery = query.toLocaleLowerCase("ru-RU");

    const documents = allDocuments.filter((doc) => {
        const searchableText = [
            doc.title,
            doc.type,
            doc.number,
            doc.date,
            formatDate(doc.date),
            doc.issuer,
        ]
            .join(" ")
            .toLocaleLowerCase("ru-RU");

        const matchesQuery = searchableText.includes(normalizedQuery);
        const matchesType = !type || doc.type === type;
        const matchesYear = !year || doc.date.startsWith(year);

        return matchesQuery && matchesType && matchesYear;
    });

    return (
        <div className={styles.page}>
            <Link href="/official" className={styles.back}>
                ← Официальная информация
            </Link>

            <header className={styles.header}>
                <p className={styles.eyebrow}>Документы</p>
                <h1>Нормативные правовые акты</h1>
                <p className={styles.intro}>
                    Постановления, распоряжения, решения и другие
                    муниципальные правовые акты. Поиск по реквизитам
                    и наименованиям документов.
                </p>
            </header>

            <form
                action="/official/documents"
                method="get"
                className={styles.filters}
            >
                <label className={styles.field}>
                    <span>Поиск документов</span>
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Название, номер, дата..."
                    />
                </label>

                <label className={styles.field}>
                    <span>Вид документа</span>
                    <select name="type" defaultValue={type}>
                        <option value="">Все виды</option>
                        {types.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.field}>
                    <span>Год</span>
                    <select name="year" defaultValue={year}>
                        <option value="">Все годы</option>
                        {years.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </label>

                <div className={styles.actions}>
                    <button type="submit">Найти</button>
                    <Link href="/official/documents">Сбросить</Link>
                </div>
            </form>

            <div className={styles.results}>
                <div className={styles.resultsHead}>
                    <h2>Документы</h2>
                    <span>Найдено: {documents.length}</span>
                </div>

                {documents.length === 0 ? (
                    <div className={styles.empty}>
                        <h3>
                            {allDocuments.length === 0
                                ? "Документы пока не добавлены"
                                : "По вашему запросу ничего не найдено"}
                        </h3>
                        <p>
                            {allDocuments.length === 0
                                ? "Реестр находится на этапе наполнения."
                                : "Попробуйте изменить поисковый запрос или фильтры."}
                        </p>
                    </div>
                ) : (
                    <div className={styles.list}>
                        {documents.map((doc) => (
                            <article key={doc.slug} className={styles.card}>
                                <div className={styles.meta}>
                                    <span>{doc.type || "Документ"}</span>
                                    {doc.number && <span>№ {doc.number}</span>}
                                    <span>{formatDate(doc.date)}</span>
                                </div>

                                <h3>{doc.title}</h3>

                                {doc.issuer && (
                                    <p className={styles.issuer}>{doc.issuer}</p>
                                )}

                                <div className={styles.links}>
                                    {isSafeLink(doc.fileUrl) && (
                                        <a
                                            href={doc.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Открыть документ ↗
                                        </a>
                                    )}

                                    {isSafeLink(doc.sourceUrl) && (
                                        <a
                                            href={doc.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Первоисточник ↗
                                        </a>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <p className={styles.note}>
                Реестр носит информационный характер.
                Юридически значимые сведения необходимо проверять
                по официальным источникам опубликования.
            </p>
        </div>
    );
}
