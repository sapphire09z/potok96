import { revalidatePath } from "next/cache";
import {
    authenticateAlertRequest, alertReply, nextAlertVersion, serviceAlertSlugExists,
    revalidateAlertPaths,
} from "@/lib/serviceAlertCms";
import { validAlertVersion, isServiceAlertPublicationReady } from "@/lib/serviceAlertValidation.mjs";

export const runtime = "nodejs";
export async function POST(request, { params }) {
    const { id } = await params;
    const auth = await authenticateAlertRequest(request, id);
    if (auth.response) return auth.response;
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return alertReply({ error: "Ожидается JSON." }, 415);
    let body;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 500) return alertReply({ error: "Слишком большой запрос." }, 413);
        body = JSON.parse(raw);
    } catch { return alertReply({ error: "Некорректный JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 2 ||
        !Object.hasOwn(body, "action") || !Object.hasOwn(body, "expectedUpdatedAt") ||
        !["publish", "unpublish"].includes(body.action) || !validAlertVersion(body.expectedUpdatedAt))
        return alertReply({ error: "Некорректный запрос публикации." }, 400);
    const from = body.action === "publish" ? "DRAFT" : "PUBLISHED";
    const to = body.action === "publish" ? "PUBLISHED" : "DRAFT";
    try {
        const item = await auth.db.serviceAlert.findUnique({ where: { id } });
        if (!item) return alertReply({ error: "Сообщение не найдено." }, 404);
        if (item.status !== from || item.updatedAt.toISOString() !== body.expectedUpdatedAt)
            return alertReply({ error: "Статус или данные изменились. Обновите страницу." }, 409);
        if (to === "PUBLISHED") {
            if (!isServiceAlertPublicationReady(item))
                return alertReply({ error: "Подтвердите достоверность, укажите источник и время. Для восстановления — фактическое время." }, 422);
            if (await serviceAlertSlugExists(item.slug, id))
                return alertReply({ error: "Адрес уже занят старым Markdown-сообщением." }, 409);
        }
        const updatedAt = nextAlertVersion(body.expectedUpdatedAt);
        const changed = await auth.db.serviceAlert.updateMany({
            where: { id, status: from, updatedAt: new Date(body.expectedUpdatedAt) },
            data: { status: to, updatedAt,
                ...(to === "PUBLISHED" ? { publishedAt: item.publishedAt ?? new Date() } : {}) },
        });
        if (changed.count !== 1) return alertReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        revalidateAlertPaths(revalidatePath);
        return alertReply({ success: true, status: to, updatedAt: updatedAt.toISOString() });
    } catch (error) {
        if (["P2002", "P2034"].includes(error?.code))
            return alertReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        console.error("Service alert publication failed", { code: error?.code ?? "unknown" });
        return alertReply({ error: "Не удалось изменить публикацию." }, 503);
    }
}
