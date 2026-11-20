import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { listContentMedia } from "@/lib/contentCleanupS3";
import { deletePrivate, deletePublic } from "@/lib/media/s3";
import { parsePermanentDeleteInput, assertOwnedInventory } from "@/lib/contentPermanentDelete.mjs";
import { mediaPrefix, cleanupPreview } from "@/lib/contentCleanupPreview.mjs";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
  if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
  const actor = await getCurrentUser();
  if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
  if (actor.role !== "ADMIN") return reply({ error: "Только для администратора." }, 403);
  const { kind, id } = await params;
  try { mediaPrefix(kind, id); }
  catch { return reply({ error: "Материал не найден." }, 404); }
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Ожидается JSON." }, 415);

  let input;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 600) return reply({ error: "Слишком большой запрос." }, 413);
    input = parsePermanentDeleteInput(JSON.parse(raw));
  } catch { return reply({ error: "Некорректный JSON." }, 400); }
  if (!input) return reply({ error: "Некорректное действие или версия материала." }, 400);

  const db = getPrisma();
  const model = kind === "news" ? "newsPost" : "eventPost";
  let marked = false;
  try {
    const account = await db.user.findUnique({ where: { id: actor.id },
      select: { role: true, archivedAt: true } });
    if (account?.role !== "ADMIN" || account.archivedAt)
      return reply({ error: "Доступ запрещён." }, 403);

    const item = await db[model].findUnique({ where: { id }, select: {
      id: true, title: true, slug: true, status: true, trashedAt: true,
      updatedAt: true, purgeStartedAt: true,
      images: { select: { id: true, storageKey: true } },
    } });
    if (!item || item.status !== "TRASHED" || !item.trashedAt)
      return reply({ error: "Материал отсутствует в корзине." }, 409);
    if (item.updatedAt.getTime() !== input.version.getTime())
      return reply({ error: "Материал изменился. Обновите страницу." }, 409);

    // Claim the exact version. The marker blocks restoration if any S3 object
    // gets deleted but a later S3/DB operation fails. Retry is idempotent.
    const now = new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1));
    const changed = await db[model].updateMany({ where: {
      id, status: "TRASHED", updatedAt: input.version,
      trashedAt: item.trashedAt,
    }, data: {
      purgeStartedAt: item.purgeStartedAt ?? now,
      updatedAt: now,
    } });
    if (changed.count !== 1)
      return reply({ error: "Конкурентное изменение. Обновите страницу." }, 409);
    marked = true;

    const { privateListing, publicListing } = await listContentMedia(kind, id);
    const keys = assertOwnedInventory(kind, id, privateListing, publicListing);
    const preview = cleanupPreview({ kind, id, images: item.images,
      privateObjects: privateListing.objects, publicObjects: publicListing.objects,
      privateTruncated: privateListing.truncated, publicTruncated: publicListing.truncated,
    });
    if (preview.invalidImages.length || !preview.listingComplete)
      throw new Error("В базе имеются некорректные связи фотографий с S3.");

    // Only the exact per-record prefix is touched; other CMS and test buckets
    // are never referenced. Missing files are safe on retry (S3 delete is idempotent).
    for (const key of keys.private) await deletePrivate(key);
    for (const key of keys.public) await deletePublic(key);

    const after = await listContentMedia(kind, id);
    const remaining = assertOwnedInventory(kind, id, after.privateListing, after.publicListing);
    if (remaining.private.length || remaining.public.length)
      throw new Error("S3 ещё содержит файлы материала. Повторите удаление.");

    await db.$transaction(async tx => {
      // Historical queue/plans have no foreign key to the post, but are now
      // obsolete. Remove their children before deleting the request itself.
      const requests = await tx.contentPurgeRequest.findMany({
        where: { kind, itemId: id }, select: { id: true },
      });
      const ids = requests.map(x => x.id);
      if (ids.length) {
        await tx.contentPurgePlan.deleteMany({ where: { requestId: { in: ids } } });
        await tx.contentPurgeRequestEvent.deleteMany({ where: { requestId: { in: ids } } });
        await tx.contentPurgeRequest.deleteMany({ where: { id: { in: ids } } });
      }
      // News comments/reports/workflow and gallery, or event images, are
      // removed through existing Prisma onDelete: Cascade relationships.
      const deleted = await tx[model].deleteMany({ where: {
        id, status: "TRASHED", updatedAt: now, purgeStartedAt: { not: null },
      } });
      if (deleted.count !== 1) throw new Error("Материал изменился во время очистки.");
      await tx.contentTrashAudit.create({ data: {
        kind, itemId: id, title: item.title, action: "purge", actorId: actor.id,
      } });
    }, { isolationLevel: "Serializable", timeout: 10000 });

    revalidatePath("/admin/trash");
    revalidatePath("/admin/trash/requests");
    revalidatePath(kind === "news" ? "/editor/news" : "/admin/events");
    revalidatePath(kind === "news" ? "/news" : "/events");
    revalidatePath(`/${kind}/${item.slug}`);
    return reply({ success: true, deleted: true });
  } catch (error) {
    console.error("Permanent content delete failed", {
      kind, id, code: error?.code || error?.name || "unknown",
    });
    return reply({ error: marked
      ? "Удаление не завершено. Материал заблокирован от восстановления; обновите корзину и нажмите «Повторить удаление». Проверьте права DeleteObject на S3."
      : "Не удалось запустить удаление. Попробуйте позже.",
      retryable: marked }, 503);
  }
}
