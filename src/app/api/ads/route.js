
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const now = new Date();

        const ads = await getPrisma().classifiedAd.findMany({
            where: {
                status: "PUBLISHED",
                slug: { not: null },
                publishedAt: { lte: now },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
            select: {
                id: true,
                slug: true,
                title: true,
                category: true,
                description: true,
                priceRub: true,
                location: true,
                publishedAt: true,
            },
            orderBy: {
                publishedAt: "desc",
            },
            take: 20,
        });

        const items = ads.map(({ description, ...ad }) => ({
            ...ad,
            summary: description.slice(0, 160),
        }));

        return NextResponse.json(
            { items, count: items.length },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("Failed to load published ads:", error);

        return NextResponse.json(
            { error: "Database unavailable" },
            { status: 503 }
        );
    }
}
