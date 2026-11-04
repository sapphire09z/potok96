
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { getAdCategoryTitle } from "@/lib/adCategories";
import styles from "./ads.module.css";
import AdLifecycleActions from "./AdLifecycleActions";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Мои объявления",
    robots: {
        index: false,
        follow: false,
    },
};

const statusLabels = {
    DRAFT: "Черновик",
    PENDING: "На модерации",
    APPROVED: "Одобрено",
    PUBLISHED: "Опубликовано",
    REJECTED: "Отклонено",
    PAUSED: "Приостановлено",
    CLOSED: "Закрыто",
    EXPIRED: "Истекло",
};

export default async function MyAdsPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    const ads = await getPrisma().classifiedAd.findMany({
        where: {
            ownerId: user.id,
        },
        select: {
            id: true,
            title: true,
            slug: true,
            category: true,
            status: true,
            priceRub: true,
            createdAt: true,
            moderationReason: true,
            expiresAt: true,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 100,
    });

    const now = new Date();

    return (
        <div className={styles.page}>
            <Link href="/account" className={styles.back}>
                ← Личный кабинет
            </Link>

            <div className={styles.topline}>
                <div>
                    <h1>Мои объявления</h1>
                    <p className={styles.lead}>
                        Всего объявлений: {ads.length}
                    </p>
                </div>

                <Link href="/account/ads/new" className={styles.primary}>
                    + Подать объявление
                </Link>
            </div>

            {ads.length === 0 ? (
                <div className={styles.empty}>
                    <h2>Объявлений пока нет</h2>
                    <p>
                        Создайте первое объявление и отправьте
                        его на модерацию.
                    </p>
                </div>
            ) : (
                <div className={styles.list}>
                    {ads.map((ad) => {
                        const expired = ["PUBLISHED", "PAUSED"].includes(ad.status) &&
                            ad.expiresAt && ad.expiresAt <= now;
                        const displayStatus = expired ? "EXPIRED" : ad.status;
                        return (
                        <article key={ad.id} className={styles.card}>
                            <div className={styles.topline}>
                <span className={styles.category}>
                  {getAdCategoryTitle(ad.category)}
                </span>
                                <span className={styles.status}>
                  {statusLabels[displayStatus] ?? displayStatus}
                </span>
                            </div>

                            <h2>{ad.title}</h2>

                            <div className={styles.meta}>
                                {ad.priceRub !== null && (
                                    <span>
                    {new Intl.NumberFormat("ru-RU").format(
                        ad.priceRub
                    )} ₽
                  </span>
                                )}

                                <span>
                  {new Intl.DateTimeFormat("ru-RU").format(
                      ad.createdAt
                  )}
                </span>
                            </div>

                            {ad.status === "REJECTED" && ad.moderationReason && (
                                <div className={styles.rejection}>
                                    <strong>Причина отклонения</strong>
                                    <p>{ad.moderationReason}</p>
                                </div>
                            )}

                            {displayStatus === "PUBLISHED" && ad.slug && (
                                <Link href={`/ads/${ad.slug}`}>
                                    Посмотреть на сайте
                                </Link>
                            )}

                            {["DRAFT", "REJECTED", "PENDING"].includes(ad.status) && (
                                <Link href={`/account/ads/${ad.id}/edit`}>
                            {ad.status === "PENDING"
                                ? "Отозвать с модерации"
                                : "Редактировать объявление"}
                        </Link>
                        )}

                            {["PUBLISHED", "PAUSED", "CLOSED", "EXPIRED"].includes(displayStatus) && (
                                <AdLifecycleActions adId={ad.id} status={displayStatus} />
                            )}
                        </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
