
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
    SESSION_COOKIE,
    revokeUserSession,
    clearSessionCookie,
} from "@/lib/session";

import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";

export async function POST(request) {
    if (!hasTrustedOrigin(request)) {
        return NextResponse.json(
            { error: "Forbidden origin" },
            { status: 403 }
        );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    try {
        await revokeUserSession(token);
    } catch {
        return NextResponse.json(
            { error: "Logout unavailable" },
            { status: 503 }
        );
    }

    const response = NextResponse.redirect(
        new URL("/login", process.env.AUTH_ALLOWED_ORIGIN),
        303
    );

    clearSessionCookie(response);

    return response;
}
