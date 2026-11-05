import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import styles from "./account.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Личный кабинет",
    robots: {
        index: false,
        follow: false,
    },
};

export default async function AccountPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    const prisma = getPrisma();
    const now = new Date();

    const [groups, expiredPublished] = await Promise.all([
        prisma.classifiedAd.groupBy({
            by: ["status"],
            where: { ownerId: user.id },
            _count: { _all: true },
        }),
        prisma.classifiedAd.count({
            where: {
                ownerId: user.id,
                status: "PUBLISHED",
                expiresAt: { lte: now },
            },
        }),
    ]);

    const counts = Object.fromEntries(
        groups.map((group) => [group.status, group._count._all])
    );
    const total = groups.reduce(
        (sum, group) => sum + group._count._all,
        0
    );

    const stats = [
        {
            label: "Опубликовано",
            value: Math.max(0, (counts.PUBLISHED ?? 0) - expiredPublished),
        },
        { label: "На модерации", value: counts.PENDING ?? 0 },
        { label: "Черновики", value: counts.DRAFT ?? 0 },
        { label: "Закрыто", value: counts.CLOSED ?? 0 },
    ];

    return (
        <div className={styles.page}>
            <header className={styles.heading}>
                <div>
                    <p className={styles.eyebrow}>Поток 96</p>
                    <h1>Личный кабинет</h1>
                    <p className={styles.lead}>
                        Управляйте своими объявлениями в одном месте.
                    </p>
                </div>

                <form action="/api/auth/logout" method="post">
                    <button type="submit" className={styles.logout}>
                        Выйти
                    </button>
                </form>
            </header>

            <section className={styles.profile} aria-labelledby="profile-heading">
                <div>
                    <h2 id="profile-heading">Мой профиль</h2>
                    <p className={styles.profileLabel}>Подтверждённый телефон</p>
                    <p className={styles.phone}>{user.phone ?? "Не указан"}</p>
                </div>
                <span className={styles.profileMark}>Аккаунт</span>
            </section>

            <section className={styles.section} aria-labelledby="ads-heading">
                <div className={styles.sectionTitle}>
                    <div>
                        <h2 id="ads-heading">Мои объявления</h2>
                        <p>Всего: {total}</p>
                    </div>
                    <Link href="/account/ads" className={styles.textLink}>
                        Все объявления →
                    </Link>
                </div>

                <div className={styles.stats}>
                    {stats.map((stat) => (
                        <div key={stat.label} className={styles.stat}>
                            <strong>{stat.value}</strong>
                            <span>{stat.label}</span>
                        </div>
                    ))}
                </div>

                <div className={styles.actions}>
                    <Link href="/account/ads/new" className={styles.primary}>
                        + Подать объявление
                    </Link>
                    <Link href="/account/ads" className={styles.secondary}>
                        Управлять объявлениями
                    </Link>
                </div>
                <p className={styles.note}>
                    Отклонённые, приостановленные и другие объявления
                    доступны в полном списке.
                </p>
            </section>
        </div>
    );
}
