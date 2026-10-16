
import Link from "next/link";
import styles from "./CityAlerts.module.css";

const serviceNames = {
    water: "Водоснабжение",
    electricity: "Электроснабжение",
    gas: "Газоснабжение",
    heating: "Отопление",
    other: "Городские службы",
};

const timeZone = "Asia/Yekaterinburg";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    day: "numeric",
    month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

function formatPeriod(startAt, endAt) {
    const start = new Date(startAt);

    if (!Number.isFinite(start.getTime())) {
        return "Время уточняется";
    }

    const startText =
        `${dateFormatter.format(start)}, ${timeFormatter.format(start)}`;

    if (!endAt) return `С ${startText}`;

    const end = new Date(endAt);

    if (!Number.isFinite(end.getTime())) {
        return `С ${startText}`;
    }

    if (dayFormatter.format(start) === dayFormatter.format(end)) {
        return `${startText}–${timeFormatter.format(end)}`;
    }

    return `${startText} — ${dateFormatter.format(end)}, ${timeFormatter.format(end)}`;
}

export default function CityAlerts({ alerts = [], limit = 2 }) {
    const visibleAlerts = alerts.slice(0, limit);

    if (!visibleAlerts.length) return null;

    return (
        <section className={styles.panel} aria-label="Городские службы">
            <div className={styles.header}>
                <h2>Городские службы</h2>

                <Link href="/alerts" className={styles.allLink}>
                    Все ({alerts.length}) →
                </Link>
            </div>

            <div className={styles.list}>
                {visibleAlerts.map((alert) => (
                    <article key={alert.slug} className={styles.item}>
                        <div className={styles.category}>
              <span>
                {serviceNames[alert.service] || serviceNames.other}
              </span>

                            {alert.urgency === "urgent" && (
                                <strong className={styles.urgent}>Срочно</strong>
                            )}
                        </div>

                        <h3>{alert.title}</h3>

                        {alert.addresses && (
                            <p className={styles.addresses}>{alert.addresses}</p>
                        )}

                        <div className={styles.period}>
                            {formatPeriod(alert.startAt, alert.expectedEndAt)}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
