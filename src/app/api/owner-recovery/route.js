import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/session";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORIGIN = "https://staging.potok96.ru";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const RESPONSE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function enabled() {
    return process.env.NODE_ENV === "production" &&
        process.env.AUTH_ALLOWED_ORIGIN === ORIGIN &&
        process.env.STAGING_OWNER_RECOVERY_ENABLED === "true" &&
        /^\+7\d{10}$/.test(process.env.STAGING_OWNER_PHONE || "");
}

function errorResponse(message, status) {
    return NextResponse.json({ error: message }, { status, headers: RESPONSE_HEADERS });
}

export async function POST(request) {
    if (!enabled()) return new Response(null, { status: 404, headers: RESPONSE_HEADERS });
    if (!hasTrustedOrigin(request)) return errorResponse("Недопустимый источник запроса.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
        return errorResponse("Ожидается JSON.", 415);
    }

    let token;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 512) return errorResponse("Неверный запрос.", 413);
        const input = JSON.parse(raw);
        token = input?.token;
    } catch {
        return errorResponse("Неверный запрос.", 400);
    }
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
        return errorResponse("Недействительная ссылка.", 400);
    }

    const grantHash = createHash("sha256").update(`owner-recovery-v1:${token}`).digest("hex");
    try {
        const session = await getPrisma().$transaction(async (tx) => {
            const grant = await tx.userSession.findUnique({
                where: { tokenHash: grantHash },
                select: {
                    id: true, userId: true, expiresAt: true,
                    user: { select: { phone: true, role: true, archivedAt: true } },
                },
            });
            if (!grant || grant.expiresAt <= new Date() ||
                grant.user.archivedAt ||
                grant.user.role !== "ADMIN" ||
                grant.user.phone !== process.env.STAGING_OWNER_PHONE) {
                return null;
            }

            // Consume the grant once, even when two requests race.
            const used = await tx.userSession.deleteMany({
                where: { id: grant.id, tokenHash: grantHash, expiresAt: { gt: new Date() } },
            });
            if (used.count !== 1) return null;

            const sessionToken = randomBytes(32).toString("base64url");
            const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
            await tx.userSession.create({
                data: {
                    id: randomUUID(), userId: grant.userId,
                    tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
                    expiresAt,
                },
            });
            return { token: sessionToken, expiresAt, userId: grant.userId };
        }, { isolationLevel: "Serializable", timeout: 10000 });

        if (!session) return errorResponse("Ссылка использована, истекла или недействительна.", 401);
        const response = NextResponse.json({ redirect: "/admin" }, { headers: RESPONSE_HEADERS });
        setSessionCookie(response, session);
        console.info("Staging owner recovery login completed", { userId: session.userId });
        return response;
    } catch (error) {
        if (error?.code === "P2034") return errorResponse("Ссылка уже использована. Создайте новую.", 409);
        console.error("Staging owner recovery login failed", { code: error?.code || "unknown" });
        return errorResponse("Не удалось завершить вход.", 503);
    }
}
