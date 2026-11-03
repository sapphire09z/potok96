import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";

const EDITABLE = ["DRAFT", "REJECTED"];
const ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const PHOTO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class PhotoActionError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function jsonError(message, status) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request, { params }) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Недопустимый источник запроса.", 403);
  }

  const user = await getCurrentUser();
  if (!user) return jsonError("Необходимо войти в аккаунт.", 401);

  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return jsonError("Объявление не найдено.", 404);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError("Ожидается JSON.", 415);
  }

  const length = request.headers.get("content-length");
  if (length && Number(length) > 2000) {
    return jsonError("Слишком большой запрос.", 413);
  }

  let body;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2000) {
      return jsonError("Слишком большой запрос.", 413);
    }
    body = JSON.parse(raw);
  } catch {
    return jsonError("Некорректный JSON.", 400);
  }

  const photoIds = body?.photoIds;
  if (!Array.isArray(photoIds) ||
      photoIds.length < 1 || photoIds.length > 8 ||
      photoIds.some((photoId) =>
        typeof photoId !== "string" || !PHOTO_ID_PATTERN.test(photoId)) ||
      new Set(photoIds).size !== photoIds.length) {
    return jsonError("Некорректный порядок фотографий.", 400);
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      const ad = await tx.classifiedAd.findFirst({
        where: { id, ownerId: user.id },
        select: { id: true, status: true },
      });
      if (!ad) throw new PhotoActionError("Объявление не найдено.", 404);
      if (!EDITABLE.includes(ad.status)) {
        throw new PhotoActionError("Сначала верните объявление в черновик.", 409);
      }

      const locked = await tx.classifiedAd.updateMany({
        where: { id, ownerId: user.id, status: { in: EDITABLE } },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new PhotoActionError("Статус объявления изменился.", 409);
      }

      const stored = await tx.adPhoto.findMany({
        where: { adId: id },
        select: { id: true },
      });
      const actualIds = new Set(stored.map((photo) => photo.id));
      if (photoIds.length !== stored.length ||
          photoIds.some((photoId) => !actualIds.has(photoId))) {
        throw new PhotoActionError("Список фотографий изменился. Обновите страницу.", 409);
      }

      for (const [index, photoId] of photoIds.entries()) {
        await tx.adPhoto.update({
          where: { id: photoId },
          data: { sortOrder: index },
        });
      }
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof PhotoActionError) {
      return jsonError(error.message, error.status);
    }
    console.error("Failed to reorder ad photos:", error);
    return jsonError("Не удалось изменить порядок фотографий.", 503);
  }
}
