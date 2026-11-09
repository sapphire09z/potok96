import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
const POST_ID = /^c[a-z0-9]{10,40}$/;
const responseError = (message, status) => NextResponse.json({ error: message }, {
    status, headers: { "Cache-Control": "no-store" },
});

// The advisory lock serializes editorial selection even when two admins click together.
// Old entries are shifted down and a fourth one drops out, but stays published.
export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) return responseError("Недопустимый источник запроса.", 403);
    const user = await getCurrentUser();
    if (!user) return responseError("Войдите в аккаунт.", 401);
    if (user.role !== "ADMIN") return responseError("Только администратор управляет главными новостями.", 403);
    const { id } = await params;
    if (!POST_ID.test(id)) return responseError("Новость не найдена.", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
        return responseError("Нужен JSON.", 415);
    }

    let input;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 1200) return responseError("Слишком большой запрос.", 413);
        input = JSON.parse(raw);
    } catch { return responseError("Некорректный JSON.", 400); }

    if (!["feature", "unfeature"].includes(input?.action) ||
        typeof input.expectedUpdatedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T/.test(input.expectedUpdatedAt)) {
        return responseError("Обновите страницу и повторите действие.", 400);
    }
    const expectedAt = new Date(input.expectedUpdatedAt);
    if (!Number.isFinite(expectedAt.getTime())) return responseError("Некорректная версия новости.", 400);

    try {
        const result = await getPrisma().$transaction(async (tx) => {
            // Return a conflict if another editor is changing the carousel right now.
            const [lock] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(953303) AS locked`;
            if (!lock?.locked) {
                return { error: "Подборку уже меняет другой администратор. Повторите.", code: 409 };
            }
            const post = await tx.newsPost.findUnique({
                where: { id }, select: { id: true, status: true, updatedAt: true, featured: true },
            });
            if (!post) return { error: "Новость не найдена.", code: 404 };
            if (post.status !== "PUBLISHED") {
                return { error: "В главные можно назначать только опубликованную новость.", code: 409 };
            }
            if (post.updatedAt.getTime() !== expectedAt.getTime()) {
                return { error: "Новость или подборка изменились. Обновите страницу.", code: 409 };
            }
            if (input.action === "unfeature" && !post.featured) {
                return { error: "Новость уже убрана из главных.", code: 409 };
            }
            const current = await tx.newsPost.findMany({
                where: { status: "PUBLISHED", featured: true },
                orderBy: [{ featuredOrder: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
                select: { id: true, featuredOrder: true },
            });
            const selected = (input.action === "feature"
                ? [id, ...current.map((row) => row.id).filter((value) => value !== id)]
                : current.map((row) => row.id).filter((value) => value !== id)).slice(0, 3);
            const desired = new Map(selected.map((value, index) => [value, index + 1]));

            // Clear displaced entries and renumber only changed entries.
            for (const row of current) {
                if (!desired.has(row.id)) {
                    await tx.newsPost.update({ where: { id: row.id },
                        data: { featured: false, featuredOrder: 99 } });
                }
            }
            for (const [featuredId, order] of desired) {
                const previous = current.find((row) => row.id === featuredId);
                if (previous?.featuredOrder === order) continue;
                const updated = await tx.newsPost.updateMany({
                    where: { id: featuredId, status: "PUBLISHED" },
                    data: { featured: true, featuredOrder: order },
                });
                if (updated.count !== 1) throw new Error("News selection changed during update");
            }
            return { featured: desired.has(id), featuredOrder: desired.get(id) ?? null };
        }, { timeout: 10000 });
        if (result.error) return responseError(result.error, result.code);
        return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("News featured selection failed", error);
        return responseError("Не удалось изменить подборку главных новостей.", 503);
    }
}
