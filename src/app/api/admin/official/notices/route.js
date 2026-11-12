import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isOfficialAdmin, officialNoticeSlugExists, readNoticeRequest } from "@/lib/officialNoticeCms";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return reply({ error: "Войдите в аккаунт." }, 401);
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, actor))) return reply({ error: "Доступ запрещён." }, 403);
    const parsed = await readNoticeRequest(request);
    if (parsed.error) return reply({ error: parsed.error }, parsed.status);
    try {
        if (await officialNoticeSlugExists(parsed.data.slug))
            return reply({ error: "Адрес страницы уже занят, в том числе старым Markdown-сообщением." }, 409);
        const item = await db.officialNotice.create({
            data: { ...parsed.data, createdById: actor.id },
            select: { id: true, updatedAt: true },
        });
        return reply({ success: true, id: item.id, updatedAt: item.updatedAt.toISOString() }, 201);
    } catch (error) {
        if (error?.code === "P2002") return reply({ error: "Такой адрес уже занят." }, 409);
        console.error("Official notice create failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось создать сообщение." }, 503);
    }
}
