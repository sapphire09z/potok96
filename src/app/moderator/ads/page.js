import { notFound, redirect } from "next/navigation";
import Image from "next/image";
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
  if (!user) redirect("/login");
  if (!["ADMIN", "MODERATOR"].includes(user.role)) notFound();

  const ads = await getPrisma().classifiedAd.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] } },
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      description: true,
      priceRub: true,
      location: true,
      contactPhone: true,
      createdAt: true,
      photos: {
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>Поток 96 / Редакция</span>
        <h1>Модерация объявлений</h1>
        <p>Ожидают решения или публикации: {ads.length}</p>
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
                <span>{new Intl.DateTimeFormat("ru-RU", {
                  timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short",
                }).format(ad.createdAt)}</span>
                {ad.status === "APPROVED" && (
                  <strong>Одобрено — ожидает копирования фото в CDN</strong>
                )}
              </div>

              <h2>{ad.title}</h2>
              <p className={styles.description}>{ad.description}</p>

              {ad.photos.length > 0 && (
                <section className={styles.moderationPhotos} aria-label="Фотографии объявления">
                  {ad.photos.map((photo, index) => (
                    <a
                      key={photo.id}
                      href={`/api/moderator/ads/${encodeURIComponent(ad.id)}/photos/${encodeURIComponent(photo.id)}?size=960`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.moderationPhoto}
                      aria-label={`Открыть фото ${index + 1}`}
                    >
                      <Image
                        src={`/api/moderator/ads/${encodeURIComponent(ad.id)}/photos/${encodeURIComponent(photo.id)}?size=320`}
                        width={160}
                        height={120}
                        alt={`Фото ${index + 1} для проверки`}
                        unoptimized
                      />
                      <span>{index + 1}{index === 0 ? " · Обложка" : ""}</span>
                    </a>
                  ))}
                </section>
              )}

              <div className={styles.details}>
                <span>{ad.priceRub === null ? "Цена не указана" :
                  `${new Intl.NumberFormat("ru-RU").format(ad.priceRub)} ₽`}</span>
                <span>{ad.location}</span>
                <span>{ad.contactPhone}</span>
              </div>

              <ModerationControls adId={ad.id} status={ad.status} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
