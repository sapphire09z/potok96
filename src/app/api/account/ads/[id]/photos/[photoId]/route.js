import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { getPrivate } from "@/lib/media/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SIZES = new Set(["320", "640", "960", "1440"]);

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const { id, photoId } = await params;
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id) ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(photoId)) {
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
