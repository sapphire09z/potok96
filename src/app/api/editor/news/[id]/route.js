import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isNewsEditor, newsSlugExists, readNewsDraftPayload } from "@/lib/newsDraft";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
    if (!hasTrustedOrigin(request)) {
        return NextResponse.json({ error: "Недопустимый источник запроса." }, { status: 403 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Войдите в аккаунт." }, { status: 401 });
    if (!isNewsEditor(user)) return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });

    const { id } = await params;
    if (typeof id !== "string" || !/^c[a-z0-9]{10,40}$/.test(id)) {
        return NextResponse.json({ error: "Материал не найден." }, { status: 404 });
    }

    const payload = await readNewsDraftPayload(request);
    if (payload.error) {
        return NextResponse.json({ error: payload.error }, { status: payload.status });
    }

    try {
        if (await newsSlugExists(payload.data.slug, id)) {
            return NextResponse.json({ error: "Такой адрес новости уже занят." }, { status: 409 });
        }
        const post = await getPrisma().newsPost.update({
            where: { id, status: "DRAFT" },
            data: payload.data,
            select: { id: true, updatedAt: true },
        });
        return NextResponse.json({ id: post.id, updatedAt: post.updatedAt.toISOString() }, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "Адрес новости уже занят." }, { status: 409 });
        }
        if (error.code === "P2025") {
            return NextResponse.json({ error: "Черновик не найден или больше недоступен для редактирования." }, { status: 409 });
        }
        console.error("Failed to update news draft", error);
        return NextResponse.json({ error: "Не удалось сохранить изменения." }, { status: 503 });
    }
}
