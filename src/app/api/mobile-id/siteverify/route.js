
import { NextResponse } from "next/server";
import { mobileIdRequest } from "@/lib/mobileId";
import {
    createUserSession,
    setSessionCookie,
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

    if (process.env.SMSAERO_MOBILEID_TEST_ENABLED !== "true") {
        return NextResponse.json(
            { error: "Mobile ID testing is disabled" },
            { status: 503 }
        );
    }

    try {
        const body = await request.json().catch(() => null);

        const sessionId = body?.session_id;
        const verifyToken = body?.verify_token;

        if (
            typeof sessionId !== "string" ||
            sessionId.length < 1 ||
            sessionId.length > 256 ||
            typeof verifyToken !== "string" ||
            verifyToken.length < 1 ||
            verifyToken.length > 2048
        ) {
            return NextResponse.json(
                { error: "Invalid verification data" },
                { status: 400 }
            );
        }

        const result = await mobileIdRequest(
            "/api/siteverify",
            sessionId,
            {
                session_id: sessionId,
                verify_token: verifyToken,
            }
        );

        const data = result.data;

        if (
            !result.ok ||
            data?.success !== true ||
            data?.status !== "verified" ||
            !/^7\d{10}$/.test(String(data?.phone ?? ""))
        ) {
            return NextResponse.json(
                { verified: false },
                { status: 401 }
            );
        }

        // Phone comes only from the trusted provider response.
        const phone = `+${data.phone}`;

        const session = await createUserSession(phone);

        const response = NextResponse.json(
            {
                verified: true,
                authenticated: true,
                phoneMasked: `+7 *** ***-${phone.slice(-4)}`,
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );

        setSessionCookie(response, session);

        return response;
    } catch {
        return NextResponse.json(
            { error: "Authentication failed" },
            { status: 502 }
        );
    }
}
