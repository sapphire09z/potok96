import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { canMoveToTrash, canRestoreFromTrash, parseContentTrashInput } from "@/lib/contentTrashPolicy.mjs";

export const runtime = "nodejs";
const POST_ID = /^c[a-z0-9]{10,40}$/;
const response = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return response({ error: "Недопустимый источник запроса." }, 403);
    const actor = await getCurrentUser();
    if (!actor) return response({ error: "Войдите в аккаунт." }, 401);
    if (actor.role !== "ADMIN") return response({ error: "Доступ запрещён." }, 403);
    const { kind, id } = await params;
    if (!["news", "events"].includes(kind) || !POST_ID.test(id))
        return response({ error: "Материал не найден." }, 404);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return response({ error: "Ожидается JSON." }, 415);
    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 1800) return response({ error: "Слишком большой запрос." }, 413);
        input = parseContentTrashInput(JSON.parse(raw));
    } catch { return response({ error: "Некорректный JSON." }, 400); }
    if (!input) return response({ error: "Неверное действие, версия или причина (от 5 до 500 символов)." }, 400);

    const db = getPrisma();
    try {
        // Revalidate the account in PostgreSQL, not just its current session cookie.
        const account = await db.user.findUnique({ where: { id: actor.id },
            select: { role: true, archivedAt: true } });
        if (account?.role !== "ADMIN" || account.archivedAt) return response({ error: "Доступ запрещён." }, 403);
        const model = kind === "news" ? "newsPost" : "eventPost";
        const result = await db.$transaction(async (tx) => {
            const row = await tx[model].findUnique({ where: { id },
                select: { id: true, title: true, slug: true, status: true, updatedAt: true } });
            if (!row) return { error: "Материал не найден.", code: 404 };
            if (row.updatedAt.getTime() !== input.version.getTime())
                return { error: "Материал изменился в другой вкладке. Обновите страницу.", code: 409 };
            const allowed = input.action === "trash" ? canMoveToTrash(kind, row.status)
                : canRestoreFromTrash(kind, row.status);
            if (!allowed) return { error: row.status === "PUBLISHED"
                ? "Сначала снимите материал с публикации." : "Материал уже сменил статус.", code: 409 };
            const now = new Date();
            const update = input.action === "trash"
                ? { status: "TRASHED", trashedAt: now, trashedById: actor.id,
                    ...(kind === "news" ? { featured: false, featuredOrder: 99 } : {}) }
                : { status: "DRAFT", trashedAt: null, trashedById: null,
                    ...(kind === "news" ? { featured: false, featuredOrder: 99 } : {}) };
            // Status+version predicate prevents races with editorial changes.
            const changed = await tx[model].updateMany({ where: {
                id, status: row.status, updatedAt: input.version,
            }, data: { ...update, updatedAt: now } });
            if (changed.count !== 1) return { error: "Конфликт изменений. Обновите страницу.", code: 409 };
            await tx.contentTrashAudit.create({ data: {
                kind, itemId: id, title: row.title, action: input.action,
                actorId: actor.id, reason: input.reason || null,
            } });
            // Restoring a record automatically cancels every pending purge request.
            // The cancellation is in the same PostgreSQL transaction as restoration.
            if (input.action === "restore") {
                const active = await tx.contentPurgeRequest.findMany({ where: {
                    kind, itemId: id, status: "PENDING",
                }, select: { id: true } });
                for (const pending of active) {
                    const cancelled = await tx.contentPurgeRequest.updateMany({ where: {
                        id: pending.id, status: "PENDING",
                    }, data: { status: "CANCELLED", cancelledAt: now, cancelledById: actor.id } });
                    if (cancelled.count === 1) await tx.contentPurgeRequestEvent.create({ data: {
                        requestId: pending.id, actorId: actor.id, action: "CANCELLED",
                        note: "Автоматически отменена при восстановлении материала",
                    } });
                }
            }
            const latest = await tx[model].findUnique({ where: { id },
                select: { updatedAt: true } });
            return { success: true, status: update.status, updatedAt: latest.updatedAt.toISOString() };
        });
        if (result.error) return response({ error: result.error }, result.code);
        revalidatePath(kind === "news" ? "/news" : "/events");
        revalidatePath(kind === "news" ? "/editor/news" : "/admin/events");
        revalidatePath("/admin/trash");
        revalidatePath("/admin/trash/requests");
        return response(result);
    } catch (error) {
        console.error("Content trash action failed", { kind, code: error?.code || "unknown" });
        return response({ error: "Не удалось изменить состояние материала." }, 503);
    }
}
