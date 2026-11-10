import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
    title: "Панель администратора",
    robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.role !== "ADMIN") notFound();

    return <div className={styles.shell}>
        <header className={styles.header}>
            <div>
                <p className={styles.eyebrow}>Поток 96 / Управление</p>
                <h1>Панель администратора</h1>
                <p className={styles.description}>Закрытый рабочий раздел. Доступ только для ADMIN.</p>
            </div>
            <Link href="/" className={styles.siteLink}>Открыть сайт</Link>
        </header>
        <nav className={styles.nav} aria-label="Разделы администрирования">
            <Link href="/admin">Обзор</Link>
            <Link href="/admin/users">Пользователи и роли</Link>
            <Link href="/admin/orgs">Организации</Link>
            <Link href="/editor/news">Редакция новостей</Link>
            <Link href="/moderator/ads">Модерация объявлений</Link>
        </nav>
        {children}
    </div>;
}
