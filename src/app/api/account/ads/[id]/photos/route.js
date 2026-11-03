import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import {
  InvalidMediaError,
  cleanupPrivateKeys,
  uploadPrivateImageSet,
} from "@/lib/media/images";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_FILE_SIZE + 128 * 1024;
const EDITABLE = ["DRAFT", "REJECTED"];

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request, { params }) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Недопустимый источник запроса.", 403);
  }

  const user = await getCurrentUser();
  if (!user) return jsonError("Необходимо войти в аккаунт.", 401);

  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
    return jsonError("Объявление не найдено.", 404);
  }

  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length <= 0) {
    return jsonError("Требуется указать размер запроса.", 411);
  }
  if (length > MAX_REQUEST_SIZE) {
    return jsonError("Фотография превышает 5 МБ.", 413);
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    return jsonError("Ожидается отправка фотографии.", 415);
  }

  const prisma = getPrisma();

  try {
    const ad = await prisma.classifiedAd.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true, status: true },
    });

    if (!ad) return jsonError("Объявление не найдено.", 404);
    if (!EDITABLE.includes(ad.status)) {
      return jsonError("Сначала верните объявление в черновик.", 409);
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!file || typeof file.arrayBuffer !== "function" ||
        typeof file.size !== "number") {
      return jsonError("Выберите фотографию.", 400);
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return jsonError("Размер фотографии: от 1 байта до 5 МБ.", 413);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await uploadPrivateImageSet({
      bytes,
      area: "ads",
      entityId: id,
    });

    try {
      await prisma.$transaction(async (tx) => {
        // Updating the parent row serializes competing photo uploads.
        const updated = await tx.classifiedAd.updateMany({
          where: { id, ownerId: user.id, status: { in: EDITABLE } },
          data: { updatedAt: new Date() },
        });
        if (updated.count !== 1) {
          throw new InvalidMediaError("Объявление уже отправлено на модерацию.");
        }

        const count = await tx.adPhoto.count({ where: { adId: id } });
        if (count >= 8) {
          throw new InvalidMediaError("Можно добавить не более 8 фотографий.");
        }

        await tx.adPhoto.create({
          data: {
            id: saved.photoId,
            adId: id,
            storageKey: saved.baseKey,
            sortOrder: count,
          },
        });
      });
    } catch (error) {
      await cleanupPrivateKeys(saved.storedKeys);
      throw error;
    }

    return NextResponse.json(
      { success: true, photoId: saved.photoId },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof InvalidMediaError) {
      return jsonError(error.message, 400);
    }
    console.error("Ad photo upload failed:", error);
    return jsonError("Не удалось загрузить фотографию.", 503);
  }
}
