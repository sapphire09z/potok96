import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { hasTrustedOrigin } from "@/lib/trustedOrigin";
import { isOfficialAdmin } from "@/lib/officialDocumentCms";
import { DOCUMENT_ID, validDocumentVersion } from "@/lib/officialDocumentValidation.mjs";

export const documentReply = (body, status = 200) => NextResponse.json(body, {
    status, headers: { "Cache-Control": "no-store" },
});
export function nextDocumentVersion(version) {
    return new Date(Math.max(Date.now(), new Date(version).getTime() + 1));
}
export async function authenticateDocumentRequest(request, rawId = null) {
    if (!hasTrustedOrigin(request)) return { response: documentReply({ error: "Недопустимый источник запроса." }, 403) };
    const actor = await getCurrentUser();
    if (!actor) return { response: documentReply({ error: "Войдите в аккаунт." }, 401) };
    if (rawId !== null && !DOCUMENT_ID.test(rawId))
        return { response: documentReply({ error: "Документ не найден." }, 404) };
    const db = getPrisma();
    if (!(await isOfficialAdmin(db, actor)))
        return { response: documentReply({ error: "Доступ запрещён." }, 403) };
    return { actor, db };
}
export function documentVersionHeader(request) {
    const version = request.headers.get("x-expected-updated-at");
    return validDocumentVersion(version) ? version : null;
}
