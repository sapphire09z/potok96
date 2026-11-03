import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { getPrivate } from "@/lib/media/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[a-zA-Z0-9_-]{8,80}$/;
const SIZES = new Set(["320", "640", "960", "1440"]);

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  if (!["ADMIN", "MODERATOR"].includes(user.role)) {
    return new Response(null, { status: 403 });
  }

  const { id, photoId } = await params;
  if (!ID.test(id) || !ID.test(photoId)) {
    return new Response(null, { status: 404 });
  }
  const size = new URL(request.url).searchParams.get("size") ?? "640";
  if (!SIZES.has(size)) return new Response(null, { status: 400 });

  try {
    const photo = await getPrisma().adPhoto.findFirst({
      where: {
        id: photoId,
        adId: id,
        ad: { is: { status: { in: ["PENDING", "APPROVED"] } } },
      },
      select: { storageKey: true },
    });
    if (!photo) return new Response(null, { status: 404 });

    const object = await getPrivate(`${photo.storageKey}/${size}.webp`);
    if (!object.Body) return new Response(null, { status: 503 });
    const bytes = await object.Body.transformToByteArray();
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Moderator ad photo read failed:", error);
    return new Response(null, { status: 503 });
  }
}
