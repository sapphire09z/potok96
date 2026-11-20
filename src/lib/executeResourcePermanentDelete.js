import { removeResourceMedia } from "./deleteResourceMedia.js";

const DELETING = "DELETING";

// ADMIN may delete any organization/ad, an owner may delete only their own ad.
// The status transition hides the record and prevents ordinary edits before
// any destructive S3 call. A failed cleanup can be retried via the same route.
export async function executeResourcePermanentDelete({ db, kind, id, actor, version }) {
  const model = kind === "orgs" ? "organization" : "classifiedAd";
  const current = await db[model].findUnique({ where: { id }, select: {
    id: true, title: true, slug: true, status: true, updatedAt: true,
    ...(kind === "ads" ? { ownerId: true } : {}),
  } });
  if (!current) return { error: "Запись не найдена.", code: 404 };
  if (kind === "ads" && actor.role !== "ADMIN" && current.ownerId !== actor.id)
    return { error: "Нет прав на это объявление.", code: 403 };
  if (current.updatedAt.getTime() !== version.getTime())
    return { error: "Запись изменилась. Обновите страницу.", code: 409 };

  if (current.status !== DELETING) {
    const changed = await db[model].updateMany({
      where: { id, status: current.status, updatedAt: version },
      data: { status: DELETING },
    });
    if (changed.count !== 1) return { error: "Конфликт изменений. Обновите страницу.", code: 409 };
  }

  const media = await removeResourceMedia(kind, id);
  await db.$transaction(async tx => {
    if (kind === "orgs") {
      // The historical application used RESTRICT for these three relationships.
      // Delete dependent review history first, then proposals, then claims.
      const proposals = await tx.orgEditProposal.findMany({ where: { orgId: id }, select: { id: true } });
      const proposalIds = proposals.map(x => x.id);
      if (proposalIds.length) {
        await tx.orgProposalReviewEvent.deleteMany({ where: { proposalId: { in: proposalIds } } });
        await tx.orgEditProposal.deleteMany({ where: { id: { in: proposalIds } } });
      }
      await tx.orgClaim.deleteMany({ where: { orgId: id } });
    }
    // Image rows cascade; the S3 objects have already been confirmed absent.
    const deleted = await tx[model].deleteMany({ where: { id, status: DELETING } });
    if (deleted.count !== 1) throw new Error("Запись изменена во время удаления.");
    await tx.contentTrashAudit.create({ data: {
      kind, itemId: id, title: current.title, actorId: actor.id, action: "purge",
    } });
  }, { isolationLevel: "Serializable", timeout: 10000 });
  return { success: true, kind, id, slug: current.slug, media };
}
