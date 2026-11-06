import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isNewsEditor, newsSlugExists, readNewsDraftPayload } from "@/lib/newsDraft";

export const runtime = "nodejs";

export async function POST(request) {
    if (!hasTrustedOrigin(request)) {
        return NextResponse.json({ error: "Недопустимый источник запроса." }, { status: 403 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Войдите в аккаунт." }, { status: 401 });
    if (!isNewsEditor(user)) return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });

    const payload = await readNewsDraftPayload(request);
    if (payload.error) {
        return NextResponse.json({ error: payload.error }, { status: payload.status });
    }

    try {
        if (await newsSlugExists(payload.data.slug)) {
            return NextResponse.json({ error: "Такой адрес новости уже занят." }, { status: 409 });
        }
        const post = await getPrisma().newsPost.create({
            data: { ...payload.data, createdById: user.id, status: "DRAFT" },
            select: { id: true, updatedAt: true },
        });
        return NextResponse.json({ id: post.id, updatedAt: post.updatedAt.toISOString() }, {
            status: 201,
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "Адрес новости уже занят." }, { status: 409 });
        }
        console.error("Failed to create news draft", error);
        return NextResponse.json({ error: "Не удалось сохранить черновик." }, { status: 503 });
    }
}
