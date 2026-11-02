
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";

export const runtime = "nodejs";

export async function POST(request, { params }) {
    if (!hasTrustedOrigin(request)) {
        return NextResponse.json(
            { error: "Недопустимый источник запроса." },
            { status: 403 }
        );
    }

    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { error: "Необходимо войти в аккаунт." },
                { status: 401 }
            );
        }

        if (!["ADMIN", "MODERATOR"].includes(user.role)) {
            return NextResponse.json(
                { error: "Недостаточно прав." },
                { status: 403 }
            );
        }

        const { id } = await params;

        if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
            return NextResponse.json(
                { error: "Объявление не найдено." },
                { status: 404 }
            );
        }

        if (!request.headers.get("content-type")
            ?.startsWith("application/json")) {
            return NextResponse.json(
                { error: "Неверный формат запроса." },
                { status: 415 }
            );
        }

        const raw = await request.text();

        if (Buffer.byteLength(raw, "utf8") > 2000) {
            return NextResponse.json(
                { error: "Слишком большой запрос." },
                { status: 413 }
            );
        }

        let body;

        try {
            body = JSON.parse(raw);
        } catch {
            return NextResponse.json(
                { error: "Некорректный JSON." },
                { status: 400 }
            );
        }

        const action = body?.action;

        if (!["approve", "reject"].includes(action)) {
            return NextResponse.json(
                { error: "Неизвестное действие." },
                { status: 400 }
            );
        }

        const reason = typeof body?.reason === "string"
            ? body.reason.trim()
            : "";

        if (
            action === "reject" &&
            (reason.length < 10 || reason.length > 500)
        ) {
            return NextResponse.json(
                { error: "Укажите причину от 10 до 500 символов." },
                { status: 400 }
            );
        }

        const now = new Date();

        const data = action === "approve"
            ? {
                status: "PUBLISHED",
                slug: `ad-${id.toLowerCase().replace(/_/g, "-")}`,
                publishedAt: now,
                expiresAt: new Date(
                    now.getTime() + 30 * 24 * 60 * 60 * 1000
                ),
                moderationReason: null,
                moderatedAt: now,
                moderatedById: user.id,
            }
            : {
                status: "REJECTED",
                slug: null,
                publishedAt: null,
                expiresAt: null,
                moderationReason: reason,
                moderatedAt: now,
                moderatedById: user.id,
            };

        const result = await getPrisma().classifiedAd.updateMany({
            where: {
                id,
                status: "PENDING",
            },
            data,
        });

        if (result.count !== 1) {
            return NextResponse.json(
                { error: "Объявление уже обработано или отозвано." },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                status: data.status,
                slug: data.slug,
            },
            {
                headers: { "Cache-Control": "no-store" },
            }
        );
    } catch (error) {
        console.error("Moderation failed:", error);

        return NextResponse.json(
            { error: "Не удалось обработать объявление." },
            { status: 503 }
        );
    }
}
