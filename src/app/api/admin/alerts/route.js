import { authenticateAlertRequest, alertReply, readAlertRequest, serviceAlertSlugExists } from "@/lib/serviceAlertCms";

export const runtime = "nodejs";
export async function POST(request) {
    const auth = await authenticateAlertRequest(request);
    if (auth.response) return auth.response;
    const parsed = await readAlertRequest(request);
    if (parsed.error) return alertReply({ error: parsed.error }, parsed.status);
    try {
        if (await serviceAlertSlugExists(parsed.data.slug))
            return alertReply({ error: "Адрес уже занят, включая старые Markdown-уведомления." }, 409);
        const item = await auth.db.serviceAlert.create({
            data: { ...parsed.data, createdById: auth.actor.id },
            select: { id: true, updatedAt: true },
        });
        return alertReply({ success: true, id: item.id, updatedAt: item.updatedAt.toISOString() }, 201);
    } catch (error) {
        if (error?.code === "P2002") return alertReply({ error: "Такой адрес уже занят." }, 409);
        console.error("Service alert creation failed", { code: error?.code ?? "unknown" });
        return alertReply({ error: "Не удалось создать уведомление." }, 503);
    }
}
