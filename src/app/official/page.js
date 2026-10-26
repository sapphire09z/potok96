
import Link from "next/link";
import styles from "./official.module.css";

export const metadata = {
    title: "Официальная информация",
    description:
        "Нормативные правовые акты, сообщения администрации и ведомств, информация городских служб Красноуфимска и района.",
};

const sections = [
    {
        id: "documents",
        number: "01",
        title: "Нормативные правовые акты",
        description:
            "Постановления, распоряжения, решения и другие муниципальные правовые акты.",
        href: "/official/documents",
    },
    {
        id: "notices",
        number: "02",
        title: "Сообщения администрации и ведомств",
        description:
            "Информационные сообщения, уведомления и объявления органов власти и учреждений.",
        href: null,
    },
    {
        id: "alerts",
        number: "03",
        title: "Городские службы",
        description:
            "Отключения воды, электроэнергии, газа, отопления и сообщения о восстановлении услуг.",
        href: "/alerts",
    },
];

export default function OfficialPage() {
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>
                    Поток 96 / Информация для жителей
                </div>

                <h1>Официальная информация</h1>

                <p>
                    Документы, сообщения органов власти и сведения
                    городских служб Красноуфимска и района.
                </p>
            </header>

            <div className={styles.grid}>
                {sections.map((section) => {
                    const content = (
                        <>
                            <div className={styles.cardTop}>
                                <span>{section.number}</span>
                                <span>
                  {section.href ? "Открыть →" : "Готовится"}
                </span>
                            </div>

                            <h2>{section.title}</h2>
                            <p>{section.description}</p>
                        </>
                    );

                    return section.href ? (
                        <Link
                            key={section.id}
                            href={section.href}
                            className={`${styles.card} ${styles.cardLink}`}
                        >
                            {content}
                        </Link>
                    ) : (
                        <div key={section.id} className={styles.card}>
                            {content}
                        </div>
                    );
                })}
            </div>

            <p className={styles.note}>
                Материалы представлены в информационных целях.
                Юридически значимые тексты нормативных правовых актов
                необходимо сверять с официальными источниками опубликования.
            </p>
        </div>
    );
}
