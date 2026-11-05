import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/session";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function stagingQaEnabled() {
    return process.env.STAGING_QA_LOGIN_ENABLED === "true" &&
        process.env.AUTH_ALLOWED_ORIGIN === "https://staging.potok96.ru" &&
        process.env.NODE_ENV === "production";
}

function hash(value) {
    return createHash("sha256").update(value).digest("hex");
}

export async function POST(request) {
    if (!stagingQaEnabled()) {
        return new Response(null, { status: 404 });
    }

    if (!hasTrustedOrigin(request)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
        return NextResponse.json({ error: "Invalid request" }, { status: 415 });
    }

    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 1024) {
        return NextResponse.json({ error: "Invalid request" }, { status: 413 });
    }

    let token;
    try {
        token = JSON.parse(raw)?.token;
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Deliberately separate QA grant hashes from actual session hashes.
    const grantHash = hash(`qa-login:${token}`);

    try {
        const session = await getPrisma().$transaction(async (tx) => {
            const grant = await tx.userSession.findUnique({
                where: { tokenHash: grantHash },
                select: {
                    id: true,
                    userId: true,
                    expiresAt: true,
                    user: { select: { role: true } },
                },
            });

            if (
                !grant ||
                grant.expiresAt <= new Date() ||
                !["USER", "MODERATOR"].includes(grant.user.role)
            ) {
                return null;
            }

            // A concurrent redemption cannot consume the same grant twice.
            const removed = await tx.userSession.deleteMany({
                where: { id: grant.id, tokenHash: grantHash },
            });
            if (removed.count !== 1) {
                return null;
            }

            const sessionToken = randomBytes(32).toString("base64url");
            const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);

            await tx.userSession.create({
                data: {
                    userId: grant.userId,
                    tokenHash: hash(sessionToken),
                    expiresAt,
                },
            });

            return { token: sessionToken, expiresAt, role: grant.user.role };
        });

        if (!session) {
            return NextResponse.json(
                { error: "Expired or used login link" },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        const response = NextResponse.json(
            { redirect: session.role === "MODERATOR" ? "/moderator/ads" : "/account" },
            { headers: { "Cache-Control": "no-store" } }
        );
        setSessionCookie(response, session);
        return response;
    } catch (error) {
        console.error("QA login failed:", error);
        return NextResponse.json(
            { error: "Login unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } }
        );
    }
}
