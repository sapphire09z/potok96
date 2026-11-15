import { revalidatePath } from "next/cache";
import {
    authenticateAlertRequest, alertReply, alertVersionHeader, nextAlertVersion,
    readAlertRequest, serviceAlertSlugExists, revalidateAlertPaths,
} from "@/lib/serviceAlertCms";
import { isServiceAlertPublicationReady } from "@/lib/serviceAlertValidation.mjs";

export const runtime = "nodejs";
export async function PATCH(request, { params }) {
    const { id } = await params;
    const auth = await authenticateAlertRequest(request, id);
    if (auth.response) return auth.response;
    const version = alertVersionHeader(request);
    if (!version) return alertReply({ error: "Обновите страницу перед сохранением." }, 400);
    const parsed = await readAlertRequest(request);
    if (parsed.error) return alertReply({ error: parsed.error }, parsed.status);
    try {
        const existing = await auth.db.serviceAlert.findUnique({ where: { id }, select: {
            slug: true, status: true, updatedAt: true,
        } });
        if (!existing) return alertReply({ error: "Сообщение не найдено." }, 404);
        if (existing.updatedAt.toISOString() !== version)
            return alertReply({ error: "Сообщение изменилось в другой сессии. Обновите страницу." }, 409);
        if (existing.status === "PUBLISHED" && existing.slug !== parsed.data.slug)
            return alertReply({ error: "Адрес опубликованного сообщения нельзя изменить." }, 409);
        if (existing.status === "PUBLISHED" && !isServiceAlertPublicationReady(parsed.data))
            return alertReply({ error: "Для опубликованного сообщения требуется подтверждение и источник." }, 422);
        if (existing.slug !== parsed.data.slug && await serviceAlertSlugExists(parsed.data.slug, id))
            return alertReply({ error: "Адрес уже занят." }, 409);
        const updatedAt = nextAlertVersion(version);
        const changed = await auth.db.serviceAlert.updateMany({
            where: { id, status: existing.status, updatedAt: new Date(version) },
            data: { ...parsed.data, updatedAt },
        });
        if (changed.count !== 1) return alertReply({ error: "Конфликт изменений. Обновите страницу." }, 409);
        if (existing.status === "PUBLISHED") revalidateAlertPaths(revalidatePath);
        return alertReply({ success: true, updatedAt: updatedAt.toISOString() });
    } catch (error) {
        if (["P2002", "P2034"].includes(error?.code))
            return alertReply({ error: "Конфликт данных. Обновите страницу." }, 409);
        console.error("Service alert update failed", { code: error?.code ?? "unknown" });
        return alertReply({ error: "Не удалось сохранить уведомление." }, 503);
    }
}
