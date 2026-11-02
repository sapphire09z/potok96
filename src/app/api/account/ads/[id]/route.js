
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { AD_CATEGORIES } from "@/lib/adCategories";

export const runtime = "nodejs";

const categories = new Set(AD_CATEGORIES.map((c) => c.id));

function validText(value, min, max) {
    return typeof value === "string" &&
        value.trim().length >= min &&
        value.trim().length <= max;
}

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) {
        return NextResponse.json(
            { error: "Недопустимый источник запроса." },
            { status: 403 }
        );
    }

    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(
            { error: "Необходимо войти в аккаунт." },
            { status: 401 }
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

    try {
        const raw = await request.text();

        if (Buffer.byteLength(raw, "utf8") > 16000) {
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

        const prisma = getPrisma();

        const existing = await prisma.classifiedAd.findFirst({
            where: { id, ownerId: user.id },
            select: { id: true },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "Объявление не найдено." },
                { status: 404 }
            );
        }

        if (body?.action === "withdraw") {
            const updated = await prisma.classifiedAd.updateMany({
                where: {
                    id,
                    ownerId: user.id,
                    status: "PENDING",
                },
                data: { status: "DRAFT" },
            });

            if (updated.count !== 1) {
                return NextResponse.json(
                    { error: "Объявление уже изменило статус." },
                    { status: 409 }
                );
            }

            return NextResponse.json({ success: true });
        }

        const title = body?.title;
        const description = body?.description;
        const location = body?.location;
        const category = body?.category;
        const priceRub = body?.priceRub;
        const status = body?.status;

        if (
            !validText(title, 5, 120) ||
            !validText(description, 20, 5000) ||
            !validText(location, 2, 120) ||
            !categories.has(category) ||
            !["DRAFT", "PENDING"].includes(status) ||
            (
                priceRub !== null &&
                (
                    !Number.isSafeInteger(priceRub) ||
                    priceRub < 0 ||
                    priceRub > 1000000000
                )
            )
        ) {
            return NextResponse.json(
                { error: "Проверьте заполнение полей." },
                { status: 400 }
            );
        }

        const updated = await prisma.classifiedAd.updateMany({
            where: {
                id,
                ownerId: user.id,
                status: { in: ["DRAFT", "REJECTED"] },
            },
            data: {
                title: title.trim(),
                description: description.trim(),
                location: location.trim(),
                category,
                priceRub,
                status,
                slug: null,
                publishedAt: null,
                expiresAt: null,

                ...(status === "PENDING"
                    ? {
                        moderationReason: null,
                        moderatedAt: null,
                        moderatedById: null,
                    }
                    : {}),

            },
        });

        if (updated.count !== 1) {
            return NextResponse.json(
                { error: "Объявление нельзя сейчас редактировать." },
                { status: 409 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update ad:", error);

        return NextResponse.json(
            { error: "Не удалось обновить объявление." },
            { status: 503 }
        );
    }
}
