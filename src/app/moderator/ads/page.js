
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { getAdCategoryTitle } from "@/lib/adCategories";
import ModerationControls from "./ModerationControls";
import styles from "./moderator.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Модерация объявлений",
    robots: { index: false, follow: false },
};

export default async function ModeratorAdsPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    if (!["ADMIN", "MODERATOR"].includes(user.role)) {
        notFound();
    }

    const ads = await getPrisma().classifiedAd.findMany({
        where: { status: "PENDING" },
        select: {
            id: true,
            title: true,
            category: true,
            description: true,
            priceRub: true,
            location: true,
            contactPhone: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 100,
    });

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <span className={styles.kicker}>Поток 96 / Редакция</span>
                <h1>Модерация объявлений</h1>
                <p>Ожидают проверки: {ads.length}</p>
            </header>

            {ads.length === 0 ? (
                <section className={styles.empty}>
                    <h2>Очередь пуста</h2>
                    <p>Новых объявлений на проверке нет.</p>
                </section>
            ) : (
                <div className={styles.list}>
                    {ads.map((ad) => (
                        <article key={ad.id} className={styles.card}>
                            <div className={styles.meta}>
                                <span>{getAdCategoryTitle(ad.category)}</span>
                                <span>
                  {new Intl.DateTimeFormat("ru-RU", {
                      timeZone: "Asia/Yekaterinburg",
                      dateStyle: "medium",
                      timeStyle: "short",
                  }).format(ad.createdAt)}
                </span>
                            </div>

                            <h2>{ad.title}</h2>

                            <p className={styles.description}>
                                {ad.description}
                            </p>

                            <div className={styles.details}>
                <span>
                  {ad.priceRub === null
                      ? "Цена не указана"
                      : `${new Intl.NumberFormat("ru-RU")
                          .format(ad.priceRub)} ₽`}
                </span>
                                <span>{ad.location}</span>
                                <span>{ad.contactPhone}</span>
                            </div>

                            <ModerationControls adId={ad.id} />
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
