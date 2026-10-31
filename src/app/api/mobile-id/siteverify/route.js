
import { NextResponse } from "next/server";
import { mobileIdRequest } from "@/lib/mobileId";

export const runtime = "nodejs";

export async function POST(request) {
    try {
        const body = await request.json().catch(() => null);
        const sessionId = body?.session_id;
        const verifyToken = body?.verify_token;

        if (process.env.SMSAERO_MOBILEID_TEST_ENABLED !== "true") {
            return NextResponse.json(
                { error: "Mobile ID testing is disabled" },
                { status: 503 }
            );
        }
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

        const phone = String(data.phone);

        // Identity is verified, but no user session is created yet.
        return NextResponse.json(
            {
                verified: true,
                phoneMasked: `+7 *** ***-${phone.slice(-4)}`,
            },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch {
        return NextResponse.json(
            { error: "Verification unavailable" },
            { status: 502 }
        );
    }
}
