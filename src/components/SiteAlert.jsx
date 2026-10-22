
import Link from "next/link";
import styles from "./SiteAlert.module.css";

const serviceNames = {
    water: "Водоснабжение",
    electricity: "Электроснабжение",
    gas: "Газоснабжение",
    heating: "Отопление",
    other: "Городские службы",
};

export default function SiteAlert({ alert }) {
    if (!alert) return null;

    return (
        <aside
            className={styles.banner}
            aria-label="Срочное сообщение городских служб"
        >
            <div className={styles.inner}>
                <div className={styles.content}>
                    <div className={styles.category}>
                        <span className={styles.indicator} />

                        Срочно · {serviceNames[alert.service] || serviceNames.other}
                    </div>

                    <div className={styles.message}>
                        <strong>{alert.title}</strong>

                        {alert.addresses && (
                            <span>{alert.addresses}</span>
                        )}
                    </div>
                </div>

                <Link href="/alerts" className={styles.link}>
                    Подробнее <span aria-hidden="true">→</span>
                </Link>
            </div>
        </aside>
    );
}
