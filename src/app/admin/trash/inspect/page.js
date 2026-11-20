import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { earliestPurgeDate } from "@/lib/contentTrashPolicy.mjs";
import { cleanupPreview, humanSize, mediaPrefix } from "@/lib/contentCleanupPreview.mjs";
import { listContentMedia } from "@/lib/contentCleanupS3";
import styles from "../trash.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Анализ очистки — Поток 96", robots: { index: false, follow: false } };
const dateLabel = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short",
});

export default async function InspectTrashItemPage({ searchParams }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") notFound();
  const db = getPrisma();
  const account = await db.user.findUnique({ where: { id: actor.id },
    select: { role: true, archivedAt: true } });
  if (account?.role !== "ADMIN" || account.archivedAt) notFound();
  const params = await searchParams;
  const kind = typeof params?.kind === "string" ? params.kind : "";
  const id = typeof params?.id === "string" ? params.id : "";
  try { mediaPrefix(kind, id); } catch { notFound(); }

  const post = kind === "news" ? await db.newsPost.findUnique({ where: { id },
    select: {
      title: true, slug: true, status: true, trashedAt: true, cover: true,
      images: { select: { id: true, storageKey: true } },
      _count: { select: { comments: true, workflowEvents: true } },
    },
  }) : await db.eventPost.findUnique({ where: { id },
    select: {
      title: true, slug: true, status: true, trashedAt: true, cover: true,
      images: { select: { id: true, storageKey: true } },
    },
  });
  if (!post || post.status !== "TRASHED") notFound();
  const eligibleAt = post.trashedAt ? earliestPurgeDate(post.trashedAt) : null;
  const eligible = Boolean(eligibleAt && eligibleAt <= new Date());
  let inventory = null;
  let scanError = false;
  try {
    const { privateListing, publicListing } = await listContentMedia(kind, id);
    inventory = cleanupPreview({
      kind, id, images: post.images,
      privateObjects: privateListing.objects, publicObjects: publicListing.objects,
      privateTruncated: privateListing.truncated,
      publicTruncated: publicListing.truncated,
    });
  } catch (error) {
    scanError = true;
    console.error("Read-only CMS S3 inventory failed", { kind, code: error?.name || "unknown" });
  }
  const relatedComments = kind === "news" ? post._count.comments : 0;
  const relatedWorkflow = kind === "news" ? post._count.workflowEvents : 0;
  const unknownObjects = inventory ?
    inventory.privateSummary.unlinked + inventory.publicSummary.unlinked +
    inventory.privateSummary.unexpected + inventory.publicSummary.unexpected : null;

  return <main className={styles.page}>
    <Link className={styles.back} href="/admin/trash">← В корзину</Link>
    <header className={styles.heading}>
      <h1>Предварительная проверка очистки</h1>
      <p>Режим только чтение. Сканирование не изменяет PostgreSQL и не удаляет файлы из Selectel.</p>
    </header>
    <section className={styles.history}>
      <h2>{post.title}</h2>
      <p className={styles.meta}>{kind === "news" ? "Новость" : "Мероприятие"} · /{post.slug} · {id}</p>
      <p>В корзине с: {post.trashedAt ? dateLabel.format(post.trashedAt) : "дата отсутствует — ошибка данных"}.</p>
      <p>Контрольная дата +30 дней: {eligibleAt ? dateLabel.format(eligibleAt) : "неизвестно"}.</p>
      <p><strong>{eligible ? "30 дней истекли" : "30 дней ещё не истекли"}.</strong> Это не разрешение на удаление.</p>
    </section>
    <section className={styles.history}>
      <h2>Связанные данные PostgreSQL</h2>
      <p>Фотографий в галерее: <strong>{post.images.length}</strong>.</p>
      {kind === "news" && <>
        <p>Комментариев: <strong>{relatedComments}</strong>.</p>
        <p>Событий редакционного процесса: <strong>{relatedWorkflow}</strong>.</p>
        <p className={styles.meta}>При прямом удалении новости связанные комментарии, их события/жалобы и редакционная история могут удалиться каскадно. Эта операция запрещена на данном этапе.</p>
      </>}
      {post.cover && <p className={styles.meta}>Есть локальная или внешняя обложка, указанная вручную. Она не входит в S3-отчёт.</p>}
    </section>
    <section className={styles.history}>
      <h2>Объекты Selectel S3</h2>
      {scanError ? <p role="alert">Не удалось получить данные S3. Отчёт неполный; ничего не удалено. Проверьте настройки и журналы приложения.</p> : <>
        <p>Приватное хранилище: <strong>{inventory.privateSummary.count} объектов, {humanSize(inventory.privateSummary.bytes)}</strong>.</p>
        <p>Публичное хранилище: <strong>{inventory.publicSummary.count} объектов, {humanSize(inventory.publicSummary.bytes)}</strong>.</p>
        <p>Объектов вне записанной галереи или с необычными именами: <strong>{unknownObjects}</strong>.</p>
        <p>Некорректных связей фотографий с ключами S3: <strong>{inventory.invalidImages.length}</strong>.</p>
        {!inventory.listingComplete && <p role="alert">Лимит 1000 объектов на хранилище достигнут. Список неполный — автоматическую очистку нельзя разрешать.</p>}
        {(inventory.hasUnexpected || inventory.invalidImages.length > 0) &&
          <p role="alert">Обнаружены неопознанные файлы или расхождения. Перед будущим удалением потребуется отдельная проверка.</p>}
        <p className={styles.meta}>Проверяется исключительно префикс {inventory.prefix} в приватном и публичном бакетах. Изображения из Markdown, Git и других разделов сюда не входят. Объекты CDN могут сохраняться в кеше после удаления из S3.</p>
      </>}
    </section>
    <section className={styles.history}>
      <h2>Решение</h2>
      <p>Это диагностический отчёт только для чтения. Окончательное удаление запускает исключительно ADMIN из корзины.</p>
      <p className={styles.meta}>При окончательном удалении будут удалены связанные записи и файлы под индивидуальным префиксом материала в Private и Public S3. Возможен временный кеш CDN.</p>
    </section>
  </main>;
}
