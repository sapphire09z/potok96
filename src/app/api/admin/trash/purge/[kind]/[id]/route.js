import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { mediaPrefix, cleanupPreview } from "@/lib/contentCleanupPreview.mjs";
import { listContentMedia } from "@/lib/contentCleanupS3";
import { parsePurgeAction, purgePreflightReport } from "@/lib/contentPurgePolicy.mjs";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "no-store" },
});
const dbConfig = { isolationLevel: "Serializable", timeout: 10000 };
const updated = () => { revalidatePath("/admin/trash/requests"); revalidatePath("/admin/trash"); };

export async function POST(request, { params }) {
  if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
  const actor = await getCurrentUser();
  if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
  if (actor.role !== "ADMIN") return reply({ error: "Только для администратора." }, 403);
  const { kind, id } = await params;
  try { mediaPrefix(kind, id); } catch { return reply({ error: "Материал не найден." }, 404); }
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Нужен JSON." }, 415);
  let input;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 1800) return reply({ error: "Слишком большой запрос." }, 413);
    input = parsePurgeAction(JSON.parse(raw));
  } catch { return reply({ error: "Некорректный запрос." }, 400); }
  if (!input) return reply({ error: "Проверьте действие, версии и причину (10–500 символов)." }, 400);

  const db = getPrisma();
  try {
    const account = await db.user.findUnique({ where: { id: actor.id }, select: { role: true, archivedAt: true } });
    if (account?.role !== "ADMIN" || account.archivedAt)
      return reply({ error: "Доступ запрещён." }, 403);
    const model = kind === "news" ? "newsPost" : "eventPost";

    if (input.action === "request") {
      const result = await db.$transaction(async tx => {
        const post = await tx[model].findUnique({ where: { id },
          select: { id: true, title: true, status: true, trashedAt: true, updatedAt: true } });
        if (!post || post.status !== "TRASHED" || !post.trashedAt)
          return { code: 409, error: "Материала нет в корзине." };
        if (post.updatedAt.getTime() !== input.updatedAt.getTime() ||
            post.trashedAt.getTime() !== input.trashedAt.getTime())
          return { code: 409, error: "Материал изменился. Обновите страницу." };
        const unique = { kind_itemId_trashedAt: { kind, itemId: id, trashedAt: post.trashedAt } };
        const prev = await tx.contentPurgeRequest.findUnique({ where: unique });
        if (prev?.status === "PENDING") return { code: 409, error: "Активная заявка уже существует." };
        let job;
        let action;
        if (prev) {
          job = await tx.contentPurgeRequest.update({ where: { id: prev.id }, data: {
            status: "PENDING", title: post.title, requestedById: actor.id, reason: input.reason,
            cancelledAt: null, cancelledById: null, lastCheckedAt: null, lastCheck: {},
          } });
          action = "REQUEUED";
        } else {
          job = await tx.contentPurgeRequest.create({ data: {
            kind, itemId: id, title: post.title, trashedAt: post.trashedAt,
            requestedById: actor.id, reason: input.reason,
          } });
          action = "CREATED";
        }
        await tx.contentPurgeRequestEvent.create({ data: {
          requestId: job.id, actorId: actor.id, action, note: input.reason,
        } });
        return { success: true, id: job.id, status: job.status };
      }, dbConfig);
      if (result.error) return reply({ error: result.error }, result.code);
      updated();
      return reply(result);
    }

    const job = await db.contentPurgeRequest.findUnique({ where: { id: input.requestId } });
    if (!job || job.kind !== kind || job.itemId !== id) return reply({ error: "Заявка не найдена." }, 404);
    if (job.status !== "PENDING" || job.updatedAt.getTime() !== input.requestUpdatedAt.getTime())
      return reply({ error: "Заявка изменена или отменена. Обновите страницу." }, 409);

    if (input.action === "cancel") {
      const result = await db.$transaction(async tx => {
        const changed = await tx.contentPurgeRequest.updateMany({ where: {
          id: job.id, status: "PENDING", updatedAt: input.requestUpdatedAt,
        }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actor.id } });
        if (changed.count !== 1) return { code: 409, error: "Заявка уже изменена." };
        await tx.contentPurgeRequestEvent.create({ data: {
          requestId: job.id, actorId: actor.id, action: "CANCELLED", note: "Отменена администратором",
        } });
        return { success: true, status: "CANCELLED" };
      }, dbConfig);
      if (result.error) return reply({ error: result.error }, result.code);
      updated();
      return reply(result);
    }

    // Manual, read-only S3/DB check outside the write transaction. The subsequent
    // conditional write rejects concurrently restored/modified materials.
    const detailSelect = kind === "news" ? {
      id: true, status: true, trashedAt: true, updatedAt: true,
      images: { select: { id: true, storageKey: true } },
      _count: { select: { comments: true, workflowEvents: true } },
    } : {
      id: true, status: true, trashedAt: true, updatedAt: true,
      images: { select: { id: true, storageKey: true } },
    };
    const item = await db[model].findUnique({ where: { id }, select: detailSelect });
    let inventory = null;
    if (item?.status === "TRASHED" && item.trashedAt?.getTime() === job.trashedAt.getTime()) {
      try {
        const { privateListing, publicListing } = await listContentMedia(kind, id);
        inventory = cleanupPreview({ kind, id, images: item.images,
          privateObjects: privateListing.objects, publicObjects: publicListing.objects,
          privateTruncated: privateListing.truncated, publicTruncated: publicListing.truncated,
        });
      } catch (error) {
        console.error("Content purge preflight S3 inventory failed", { kind, code: error?.name || "unknown" });
      }
    }
    const report = purgePreflightReport({ item, request: job, inventory });
    const result = await db.$transaction(async tx => {
      const still = await tx[model].findUnique({ where: { id },
        select: { updatedAt: true, trashedAt: true, status: true } });
      if ((item?.updatedAt?.getTime() ?? null) !== (still?.updatedAt?.getTime() ?? null) ||
          (item?.trashedAt?.getTime() ?? null) !== (still?.trashedAt?.getTime() ?? null) ||
          item?.status !== still?.status)
        return { code: 409, error: "Материал изменён во время проверки. Запустите её снова." };
      const changed = await tx.contentPurgeRequest.updateMany({ where: {
        id: job.id, status: "PENDING", updatedAt: input.requestUpdatedAt,
      }, data: { lastCheckedAt: new Date(report.checkedAt), lastCheck: report } });
      if (changed.count !== 1) return { code: 409, error: "Заявка изменилась. Обновите страницу." };
      await tx.contentPurgeRequestEvent.create({ data: {
        requestId: job.id, actorId: actor.id, action: "CHECKED", note: `Результат: ${report.outcome}. Удаление заблокировано.`,
      } });
      return { success: true, status: "PENDING", report };
    }, dbConfig);
    if (result.error) return reply({ error: result.error }, result.code);
    updated();
    return reply(result);
  } catch (error) {
    if (error?.code === "P2034" || error?.code === "P2002")
      return reply({ error: "Конкурентное изменение. Обновите страницу и повторите действие." }, 409);
    console.error("Content purge request failed", { kind, code: error?.code || "unknown" });
    return reply({ error: "Не удалось обработать заявку." }, 503);
  }
}
