import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { mediaPrefix, cleanupPreview } from "@/lib/contentCleanupPreview.mjs";
import { listContentMedia } from "@/lib/contentCleanupS3";
import { parsePurgePlanInput, buildPurgeDryRun } from "@/lib/contentPurgePlan.mjs";

export const runtime = "nodejs";
const respond = (value, status = 200) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "no-store" },
});
const transactionOptions = { isolationLevel: "Serializable", timeout: 10000 };

// Creates an immutable DRY-RUN snapshot; it does not approve, schedule, or execute deletion.
export async function POST(request, { params }) {
  if (!hasTrustedOrigin(request)) return respond({ error: "Недопустимый источник запроса." }, 403);
  const actor = await getCurrentUser();
  if (!actor) return respond({ error: "Войдите в аккаунт." }, 401);
  if (actor.role !== "ADMIN") return respond({ error: "Доступ запрещён." }, 403);
  const { kind, id } = await params;
  try { mediaPrefix(kind, id); } catch { return respond({ error: "Материал не найден." }, 404); }
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return respond({ error: "Нужен JSON." }, 415);
  let input;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 1024) return respond({ error: "Слишком большой запрос." }, 413);
    input = parsePurgePlanInput(JSON.parse(raw));
  } catch { return respond({ error: "Некорректный JSON." }, 400); }
  if (!input) return respond({ error: "Неверный идентификатор заявки или версия." }, 400);

  const db = getPrisma();
  try {
    const account = await db.user.findUnique({ where: { id: actor.id },
      select: { role: true, archivedAt: true } });
    if (account?.role !== "ADMIN" || account.archivedAt)
      return respond({ error: "Доступ запрещён." }, 403);

    const job = await db.contentPurgeRequest.findUnique({ where: { id: input.requestId } });
    if (!job || job.kind !== kind || job.itemId !== id) return respond({ error: "Заявка не найдена." }, 404);
    if (job.status !== "PENDING" || job.updatedAt.getTime() !== input.requestUpdatedAt.getTime())
      return respond({ error: "Заявка изменена. Обновите страницу." }, 409);

    const model = kind === "news" ? "newsPost" : "eventPost";
    const select = {
      id: true, status: true, cover: true, trashedAt: true, updatedAt: true,
      images: { select: { id: true, storageKey: true } },
      ...(kind === "news" ? { _count: { select: { comments: true, workflowEvents: true } } } : {}),
    };
    const item = await db[model].findUnique({ where: { id }, select });
    if (!item || item.status !== "TRASHED" || !item.trashedAt ||
        item.trashedAt.getTime() !== job.trashedAt.getTime())
      return respond({ error: "Материал восстановлен либо заявка устарела." }, 409);

    const [commentEventCount, commentReportCount] = kind === "news" ? await Promise.all([
      db.newsCommentEvent.count({ where: { comment: { postId: id } } }),
      db.newsCommentReport.count({ where: { comment: { postId: id } } }),
    ]) : [0, 0];
    let inventory = null;
    let privateObjects = [];
    let publicObjects = [];
    try {
      const { privateListing, publicListing } = await listContentMedia(kind, id);
      privateObjects = privateListing.objects;
      publicObjects = publicListing.objects;
      inventory = cleanupPreview({ kind, id, images: item.images,
        privateObjects, publicObjects,
        privateTruncated: privateListing.truncated, publicTruncated: publicListing.truncated,
      });
    } catch (error) {
      console.error("Purge dry-run S3 inventory failed", { kind, code: error?.name || "unknown" });
    }
    const plan = buildPurgeDryRun({ kind, id, request: job, item, inventory,
      privateObjects, publicObjects, commentEventCount, commentReportCount });

    // A plan is historical evidence, not authority to purge. Recheck the DB
    // snapshot before saving it and never modify the source material or job.
    const saved = await db.$transaction(async tx => {
      const [currentJob, currentItem] = await Promise.all([
        tx.contentPurgeRequest.findUnique({ where: { id: job.id },
          select: { status: true, updatedAt: true, trashedAt: true } }),
        tx[model].findUnique({ where: { id }, select: {
          status: true, updatedAt: true, trashedAt: true,
        } }),
      ]);
      if (!currentJob || currentJob.status !== "PENDING" ||
          currentJob.updatedAt.getTime() !== input.requestUpdatedAt.getTime() ||
          currentJob.trashedAt.getTime() !== job.trashedAt.getTime() ||
          !currentItem || currentItem.status !== "TRASHED" ||
          currentItem.updatedAt.getTime() !== item.updatedAt.getTime() ||
          currentItem.trashedAt?.getTime() !== item.trashedAt.getTime()) return null;
      const created = await tx.contentPurgePlan.create({ data: {
        requestId: job.id, kind, itemId: id, trashedAt: job.trashedAt,
        requestUpdatedAt: job.updatedAt, materialUpdatedAt: item.updatedAt,
        actorId: actor.id, status: plan.status, digest: plan.digest, report: plan.report,
      }, select: { id: true } });
      await tx.contentPurgeRequestEvent.create({ data: {
        requestId: job.id, actorId: actor.id, action: "PLANNED",
        note: `Сохранён план без удаления: ${plan.status}; SHA256 ${plan.digest.slice(0, 16)}…`,
      } });
      return created;
    }, transactionOptions);
    if (!saved) return respond({ error: "Материал или заявка изменились во время проверки." }, 409);
    revalidatePath("/admin/trash/requests");
    return respond({ success: true, planId: saved.id, outcome: plan.status,
      deletionAllowed: false, digest: plan.digest });
  } catch (error) {
    if (error?.code === "P2034") return respond({ error: "Конкурентное изменение. Повторите проверку." }, 409);
    console.error("Purge dry-run failed", { kind, code: error?.code || "unknown" });
    return respond({ error: "Не удалось подготовить план. Данные не удалены." }, 503);
  }
}
