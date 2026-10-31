
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const prisma = getPrisma();

        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json(
            { status: "ok" },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("Database health check failed:", error);

        return NextResponse.json(
            { status: "unavailable" },
            {
                status: 503,
                headers: { "Cache-Control": "no-store" },
            }
        );
    }
}
