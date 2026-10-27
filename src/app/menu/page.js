import Link from "next/link";

import styles from "./menu.module.css";

export const metadata = {
    title: "Меню — Поток 96",
    description: "Разделы городского портала Поток 96",
};

export default function MenuPage() {
    return (
        <main className={styles.page}>
            <section className={styles.content}>
                <form className={styles.search} action="/search" method="get">
                    <input type="search" name="q" placeholder="Поиск" />
                    <button type="submit">Найти</button>
                </form>

                <Link href="/" className={styles.home}>
                    Главная
                </Link>

                <details className={styles.section}>
                    <summary>Новости</summary>
                    <div className={styles.links}>
                        <Link href="/news">Все новости</Link>
                        <Link href="/news/category/город">Город</Link>
                        <Link href="/news/category/люди">Люди</Link>
                        <Link href="/news/category/организации">Организации</Link>
                    </div>
                </details>

                <details className={styles.section}>
                    <summary>Афиша</summary>
                    <div className={styles.links}>
                        <Link href="/events">Все события</Link>
                        <Link href="/events">Ближайшие</Link>
                        <Link href="/events/cinema">Киноафиша и сеансы</Link>
                    </div>
                </details>

                <details className={styles.section}>
                    <summary>Справочник</summary>
                    <div className={styles.links}>
                        <Link href="/orgs">Все организации</Link>
                        <Link href="/orgs">Учреждения</Link>
                        <Link href="/orgs">Услуги</Link>
                        <Link href="/orgs">Спорт и культура</Link>
                    </div>
                </details>
                <details className={styles.section}>
                    <summary>Официально</summary>
                    <div className={styles.links}>
                        <Link href="/official">Нормативные провавые акты</Link>
                        <Link href="/official">Сообщения администрации и ведомств</Link>
                        <Link href="/official">Городские службы</Link>
                    </div>
                </details>
                <details className={styles.section}>
                    <summary>Объявления</summary>
                    <div className={styles.links}>
                        <Link href="/ads">Все объявления</Link>
                        <Link href="/ads">Продажа</Link>
                        <Link href="/ads">Услуги</Link>
                        <Link href="/ads">Вакансии</Link>
                    </div>
                </details>

                <Link href="/about" className={styles.about}>
                    О проекте
                </Link>
            </section>
        </main>
    );
}