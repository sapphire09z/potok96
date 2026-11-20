import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { deletionPrefixes, parseResourceDeleteInput } from "@/lib/resourcePermanentDelete.mjs";
import { executeResourcePermanentDelete } from "@/lib/executeResourcePermanentDelete";

export const runtime = "nodejs";
const reply = (body, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
  if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
  const actor = await getCurrentUser();
  if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
  const { id } = await params;
  try { deletionPrefixes("ads", id); } catch { return reply({ error: "Объявление не найдено." }, 404); }
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Нужен JSON." }, 415);
  let input;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 400) return reply({ error: "Слишком большой запрос." }, 413);
    input = parseResourceDeleteInput(JSON.parse(raw));
  } catch { return reply({ error: "Некорректный JSON." }, 400); }
  if (!input) return reply({ error: "Некорректное действие или версия." }, 400);

  const db = getPrisma();
  try {
    const account = await db.user.findUnique({ where: { id: actor.id }, select: { role: true, archivedAt: true } });
    if (!account || account.archivedAt || account.role !== actor.role)
      return reply({ error: "Доступ запрещён." }, 403);
    const result = await executeResourcePermanentDelete({
      db, kind: "ads", id, actor, version: input.version,
    });
    if (result.error) return reply({ error: result.error }, result.code);
    revalidatePath("/admin/ads");
    revalidatePath("/account/ads");
    revalidatePath("/moderator/ads");
    revalidatePath("/admin/trash");
    revalidatePath("/ads");
    if (result.slug) revalidatePath(`/ads/${result.slug}`);
    return reply(result);
  } catch (error) {
    console.error("Permanent ad deletion failed", { id, code: error?.code || error?.name || "unknown" });
    return reply({ error: "Не удалось завершить удаление. Обновите страницу и нажмите «Повторить удаление»." }, 503);
  }
}
