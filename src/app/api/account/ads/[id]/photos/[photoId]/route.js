import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { getPrivate, deletePrivate } from "@/lib/media/s3";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SIZES = new Set(["320", "640", "960", "1440"]);
const EDITABLE = ["DRAFT", "REJECTED"];
const ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

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

// The owner alone may view private photos, even while an ad is pending.
export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, photoId } = await params;
  if (!ID_PATTERN.test(id) || !ID_PATTERN.test(photoId)) {
    return new Response(null, { status: 404 });
  }

  const size = new URL(request.url).searchParams.get("size") ?? "320";
  if (!ALLOWED_SIZES.has(size)) {
    return new Response(null, { status: 400 });
  }

  try {
    const photo = await getPrisma().adPhoto.findFirst({
      where: {
        id: photoId,
        adId: id,
        ad: { is: { ownerId: user.id } },
      },
      select: { storageKey: true },
    });
    if (!photo) return new Response(null, { status: 404 });

    const object = await getPrivate(`${photo.storageKey}/${size}.webp`);
    const bytes = await object.Body.transformToByteArray();

    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Private ad photo read failed:", error);
    return new Response(null, { status: 503 });
  }
}

// Remove one picture and close sortOrder gaps. S3 cleanup happens after the
// transaction: a failed object deletion must not leave a broken DB reference.
export async function DELETE(request, { params }) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Недопустимый источник запроса.", 403);
  }

  const user = await getCurrentUser();
  if (!user) return jsonError("Необходимо войти в аккаунт.", 401);

  const { id, photoId } = await params;
  if (!ID_PATTERN.test(id) || !ID_PATTERN.test(photoId)) {
    return jsonError("Фотография не найдена.", 404);
  }

  try {
    const prisma = getPrisma();
    const storageKey = await prisma.$transaction(async (tx) => {
      const ad = await tx.classifiedAd.findFirst({
        where: { id, ownerId: user.id },
        select: { id: true, status: true },
      });
      if (!ad) throw new PhotoActionError("Объявление не найдено.", 404);
      if (!EDITABLE.includes(ad.status)) {
        throw new PhotoActionError("Сначала верните объявление в черновик.", 409);
      }

      // Acquire the parent-row lock to serialize delete/order/upload actions.
      const locked = await tx.classifiedAd.updateMany({
        where: { id, ownerId: user.id, status: { in: EDITABLE } },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) {
        throw new PhotoActionError("Статус объявления изменился.", 409);
      }

      const photo = await tx.adPhoto.findFirst({
        where: { id: photoId, adId: id },
        select: { storageKey: true },
      });
      if (!photo) throw new PhotoActionError("Фотография не найдена.", 404);

      await tx.adPhoto.delete({ where: { id: photoId } });

      const remaining = await tx.adPhoto.findMany({
        where: { adId: id },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, sortOrder: true },
      });
      for (const [position, item] of remaining.entries()) {
        if (item.sortOrder !== position) {
          await tx.adPhoto.update({
            where: { id: item.id },
            data: { sortOrder: position },
          });
        }
      }

      return photo.storageKey;
    });

    // The initial uploader stores the original extension only in its object
    // name. Deleting all supported candidates is safe and idempotent.
    const keys = [
      `${storageKey}/original.jpg`,
      `${storageKey}/original.png`,
      `${storageKey}/original.webp`,
      ...[320, 640, 960, 1440].map((size) => `${storageKey}/${size}.webp`),
    ];
    const results = await Promise.allSettled(keys.map((key) => deletePrivate(key)));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      console.error("Ad photo S3 cleanup incomplete:", {
        adId: id,
        photoId,
        failedObjects: failures.length,
      });
    }

    return NextResponse.json(
      { success: true, storageCleanupPending: failures.length > 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof PhotoActionError) {
      return jsonError(error.message, error.status);
    }
    console.error("Failed to delete ad photo:", error);
    return jsonError("Не удалось удалить фотографию.", 503);
  }
}
