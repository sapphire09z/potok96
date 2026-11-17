import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
const reply = (data, status = 200) => NextResponse.json(data, {
    status, headers: { "Cache-Control": "no-store" },
});
async function authorizedAdmin() {
    const user = await getCurrentUser();
    if (!user) return { response: reply({ error: "Войдите в аккаунт." }, 401) };
    if (user.role !== "ADMIN") return { response: reply({ error: "Доступ запрещён." }, 403) };
    return { user };
}
const fields = { id: true, trigger: true, status: true, createdAt: true,
    startedAt: true, finishedAt: true, movieCount: true, sessionCount: true,
    posterCandidates: true, posterUpdated: true, posterUnchanged: true,
    posterSkipped: true, posterFailures: true, posterFullScan: true, error: true };

export async function GET() {
    const auth = await authorizedAdmin();
    if (auth.response) return auth.response;
    try {
        const runs = await getPrisma().cinemaSyncRun.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: fields });
        return reply({ runs });
    } catch (error) {
        console.error("Cinema sync history failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось получить журнал обновлений." }, 503);
    }
}

export async function POST(request) {
    if (!hasTrustedOrigin(request)) return reply({ error: "Недопустимый источник запроса." }, 403);
    const auth = await authorizedAdmin();
    if (auth.response) return auth.response;
    try {
        const db = getPrisma();
        const existing = await db.cinemaSyncRun.findFirst({
            where: { status: { in: ["QUEUED", "RUNNING"] } },
            orderBy: { createdAt: "asc" }, select: { id: true, status: true },
        });
        if (existing) return reply({ error: "Синхронизация уже запланирована или выполняется.", runId: existing.id }, 409);
        const recentManual = await db.cinemaSyncRun.findFirst({
            where: { trigger: "MANUAL", createdAt: { gte: new Date(Date.now() - 60_000) } },
            select: { id: true },
        });
        if (recentManual) return reply({ error: "Повторное ручное обновление возможно через минуту." }, 429);
        const run = await db.cinemaSyncRun.create({ data: {
            trigger: "MANUAL", requestedById: auth.user.id,
        }, select: { id: true, status: true } });
        return reply({ id: run.id, status: run.status }, 202);
    } catch (error) {
        if (error?.code === "P2002") return reply({ error: "Синхронизация уже поставлена в очередь." }, 409);
        console.error("Cinema sync request failed", { code: error?.code ?? "unknown" });
        return reply({ error: "Не удалось поставить обновление в очередь." }, 503);
    }
}
