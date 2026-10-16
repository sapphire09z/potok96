
import ReactMarkdown from "react-markdown";
import { getAllAlerts } from "@/lib/alerts";
import EmptyState from "@/components/EmptyState";
import styles from "./alerts.module.css";

export const metadata = {
    title: "Городские службы",
    description:
        "Сообщения городских служб Красноуфимска и района: отключения воды, электричества, газа и отопления.",
};

export const dynamic = "force-dynamic";

const serviceNames = {
    water: "Водоснабжение",
    electricity: "Электроснабжение",
    gas: "Газоснабжение",
    heating: "Отопление",
    other: "Прочие сообщения",
};

const stateNames = {
    planned: "Запланировано",
    active: "Действует",
    restored: "Восстановлено",
};

function formatTime(value) {
    if (!value) return "Не указано";

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) return "Не указано";

    return new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Asia/Yekaterinburg",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function startTime(alert) {
    const value = new Date(alert.startAt).getTime();
    return Number.isFinite(value) ? value : 0;
}

function AlertCard({ alert }) {
    return (
        <article className={styles.card}>
            <div className={styles.cardTop}>
        <span className={styles.category}>
          {serviceNames[alert.service] || serviceNames.other}
        </span>

                <span className={styles.state}>
          {alert.urgency === "urgent" && "Срочно · "}
                    {stateNames[alert.state] || "Уточняется"}
        </span>
            </div>

            <h3>{alert.title}</h3>

            {alert.addresses && (
                <div className={styles.addresses}>
                    <span>Территория</span>
                    <strong>{alert.addresses}</strong>
                </div>
            )}

            <div className={styles.times}>
                {alert.startAt && (
                    <div>
                        <span>Начало</span>
                        <strong>{formatTime(alert.startAt)}</strong>
                    </div>
                )}

                {alert.expectedEndAt && (
                    <div>
                        <span>Планируемое окончание</span>
                        <strong>{formatTime(alert.expectedEndAt)}</strong>
                    </div>
                )}
            </div>

            {alert.content && (
                <div className={styles.content}>
                    <ReactMarkdown>{alert.content}</ReactMarkdown>
                </div>
            )}

            {alert.source && (
                <div className={styles.source}>
                    Источник: {alert.source}
                </div>
            )}
        </article>
    );
}

export default async function AlertsPage() {
    const alerts = (await getAllAlerts()).filter(
        (alert) => alert.status === "published"
    );

    const current = alerts
        .filter((alert) => ["planned", "active"].includes(alert.state))
        .sort((a, b) => {
            const rank = (item) =>
                item.urgency === "urgent" && item.state === "active"
                    ? 0
                    : item.state === "active"
                        ? 1
                        : 2;

            return rank(a) - rank(b) || startTime(a) - startTime(b);
        });

    const archive = alerts
        .filter((alert) => alert.state === "restored")
        .sort((a, b) => startTime(b) - startTime(a));

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>Информация для жителей</div>
                <h1>Городские службы</h1>
                <p>
                    Сообщения об отключениях, плановых работах и восстановлении
                    коммунальных услуг в Красноуфимске и районе.
                </p>
            </header>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>Актуальные сообщения</h2>
                    <span>{current.length}</span>
                </div>

                {current.length === 0 ? (
                    <EmptyState
                        title="Актуальных сообщений нет"
                        text="Новых сведений об отключениях пока не опубликовано."
                    />
                ) : (
                    <div className={styles.list}>
                        {current.map((alert) => (
                            <AlertCard key={alert.slug} alert={alert} />
                        ))}
                    </div>
                )}
            </section>

            {archive.length > 0 && (
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Архив сообщений</h2>
                        <span>{archive.length}</span>
                    </div>

                    <div className={styles.list}>
                        {archive.map((alert) => (
                            <AlertCard key={alert.slug} alert={alert} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
