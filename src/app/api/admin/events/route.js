import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { eventSlugExists, isActiveAdmin, parseEventRequest } from "@/lib/eventCms";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const db = getPrisma();
    if (!(await isActiveAdmin(db, actor))) return reply({ error: "Доступ запрещён." }, 403);
    const parsed = await parseEventRequest(request);
    if (parsed.error) return reply({ error: parsed.error }, parsed.status);
    try {
        if (await eventSlugExists(parsed.data.slug)) return reply({ error: "Такой адрес уже занят, в том числе среди старых мероприятий." }, 409);
        const item = await db.eventPost.create({ data: {
            ...parsed.data, createdById: actor.id,
        }, select: { id: true, updatedAt: true } });
        return reply({ success: true, id: item.id, updatedAt: item.updatedAt.toISOString() }, 201);
    } catch (error) {
        if (error?.code === "P2002") return reply({ error: "Такой адрес уже занят." }, 409);
        console.error("Create event failed", { code: error?.code || "unknown" });
        return reply({ error: "Не удалось создать мероприятие." }, 503);
    }
}
