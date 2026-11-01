
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { AD_CATEGORIES } from "@/lib/adCategories";

export const runtime = "nodejs";

const categories = new Set(
    AD_CATEGORIES.map((item) => item.id)
);

function validText(value, min, max) {
    return typeof value === "string" &&
        value.trim().length >= min &&
        value.trim().length <= max;
}

export async function POST(request) {
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

        if (!/^\+7\d{10}$/.test(user.phone ?? "")) {
            return NextResponse.json(
                { error: "Необходимо подтвердить телефон." },
                { status: 403 }
            );
        }

        if (
            !request.headers.get("content-type")
                ?.startsWith("application/json")
        ) {
            return NextResponse.json(
                { error: "Неверный формат запроса." },
                { status: 415 }
            );
        }

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

        const title = body?.title?.trim?.();
        const description = body?.description?.trim?.();
        const location = body?.location?.trim?.();
        const category = body?.category;
        const status = body?.status;
        const priceRub = body?.priceRub;

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

        const prisma = getPrisma();

        const createdToday = await prisma.classifiedAd.count({
            where: {
                ownerId: user.id,
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            },
        });

        if (createdToday >= 20) {
            return NextResponse.json(
                { error: "Достигнут лимит объявлений за 24 часа." },
                { status: 429 }
            );
        }

        const ad = await prisma.classifiedAd.create({
            data: {
                ownerId: user.id,
                title,
                category,
                description,
                priceRub,
                location,
                contactPhone: user.phone,
                status,
                slug: null,
                publishedAt: null,
            },
            select: {
                id: true,
                status: true,
            },
        });

        return NextResponse.json(
            { success: true, ad },
            {
                status: 201,
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("Failed to create classified ad:", error);

        return NextResponse.json(
            { error: "Не удалось сохранить объявление." },
            { status: 503 }
        );
    }
}
