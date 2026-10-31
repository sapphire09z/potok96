
import { NextResponse } from "next/server";
import { mobileIdRequest } from "@/lib/mobileId";

export const runtime = "nodejs";

export async function POST(request) {
    try {
        const body = await request.json().catch(() => null);
        const fingerprint = body?.fingerprint_hash;

        if (process.env.SMSAERO_MOBILEID_TEST_ENABLED !== "true") {
            return NextResponse.json(
                { error: "Mobile ID testing is disabled" },
                { status: 503 }
            );
        }
        if (
            typeof fingerprint !== "string" ||
            fingerprint.length < 8 ||
            fingerprint.length > 256 ||
            !/^[a-zA-Z0-9_-]+$/.test(fingerprint)
        ) {
            return NextResponse.json(
                { error: "Invalid fingerprint" },
                { status: 400 }
            );
        }

        const result = await mobileIdRequest(
            "/api/token",
            fingerprint,
            { fingerprint_hash: fingerprint }
        );

        if (
            !result.ok ||
            typeof result.data?.token !== "string"
        ) {
            return NextResponse.json(
                { error: "Mobile ID unavailable" },
                { status: 502 }
            );
        }

        return NextResponse.json(result.data, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        return NextResponse.json(
            { error: "Mobile ID request failed" },
            { status: 502 }
        );
    }
}
