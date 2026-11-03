import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { publishAdPhotos } from "@/lib/media/publishAds";

export const runtime = "nodejs";

function jsonError(message, status) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request, { params }) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Недопустимый источник запроса.", 403);
  }

  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Необходимо войти в аккаунт.", 401);
    if (!["ADMIN", "MODERATOR"].includes(user.role)) {
      return jsonError("Недостаточно прав.", 403);
    }

    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
      return jsonError("Объявление не найдено.", 404);
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return jsonError("Неверный формат запроса.", 415);
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2000) {
      return jsonError("Слишком большой запрос.", 413);
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError("Некорректный JSON.", 400);
    }
    const action = body?.action;
    if (!["approve", "reject"].includes(action)) {
      return jsonError("Неизвестное действие.", 400);
    }
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (action === "reject" && (reason.length < 10 || reason.length > 500)) {
      return jsonError("Укажите причину от 10 до 500 символов.", 400);
    }

    const prisma = getPrisma();
    const now = new Date();

    if (action === "reject") {
      const result = await prisma.classifiedAd.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "REJECTED",
          slug: null,
          publishedAt: null,
          expiresAt: null,
          moderationReason: reason,
          moderatedAt: now,
          moderatedById: user.id,
        },
      });
      if (result.count !== 1) {
        return jsonError("Объявление уже обработано или отозвано.", 409);
      }
      return NextResponse.json({ success: true, status: "REJECTED" },
        { headers: { "Cache-Control": "no-store" } });
    }

    // Claim moderation before copying images: only one moderator may move
    // an ad out of PENDING. APPROVED means S3 publishing can be retried.
    await prisma.classifiedAd.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "APPROVED",
        moderatedAt: now,
        moderatedById: user.id,
        moderationReason: null,
      },
    });

    const ad = await prisma.classifiedAd.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        photos: {
          select: { storageKey: true },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!ad || ad.status !== "APPROVED") {
      return jsonError("Объявление уже обработано или отозвано.", 409);
    }

    try {
      await publishAdPhotos(ad.photos);
    } catch (error) {
      // Remain APPROVED, not PUBLISHED. Moderator can retry safely.
      console.error("Ad CDN publish failed; awaiting retry:", { adId: id, error });
      return jsonError("Фотографии не опубликованы. Повторите публикацию в панели модерации.", 503);
    }

    const publishedAt = new Date();
    const result = await prisma.classifiedAd.updateMany({
      where: { id, status: "APPROVED" },
      data: {
        status: "PUBLISHED",
        slug: `ad-${id.toLowerCase().replace(/_/g, "-")}`,
        publishedAt,
        expiresAt: new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        moderationReason: null,
      },
    });
    if (result.count !== 1) {
      return jsonError("Публикация уже завершена. Обновите страницу.", 409);
    }

    return NextResponse.json({
      success: true,
      status: "PUBLISHED",
      slug: `ad-${id.toLowerCase().replace(/_/g, "-")}`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Moderation failed:", error);
    return jsonError("Не удалось обработать объявление.", 503);
  }
}
