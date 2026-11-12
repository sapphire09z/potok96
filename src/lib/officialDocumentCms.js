import fs from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "@/lib/prisma";
import { validateOfficialDocument } from "@/lib/officialDocumentValidation.mjs";
import { isOfficialAdmin } from "@/lib/officialNoticeCms";

const ROOT = path.join(process.cwd(), "content", "official", "documents");
export { isOfficialAdmin };

export async function officialDocumentSlugExists(slug, exceptId = null) {
    let files;
    try { files = await fs.readdir(ROOT); }
    catch (e) { if (e?.code === "ENOENT") files = []; else throw e; }
    // Even unpublished legacy Markdown reserves its pathname.
    if (files.includes(`${slug}.md`)) return true;
    const row = await getPrisma().officialDocument.findFirst({
        where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true },
    });
    return Boolean(row);
}

export async function readDocumentRequest(request) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
        return { error: "Ожидается JSON.", status: 415 };
    let value;
    try {
        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > 45000)
            return { error: "Слишком большой запрос.", status: 413 };
        value = JSON.parse(raw);
    } catch { return { error: "Некорректный JSON.", status: 400 }; }
    const data = validateOfficialDocument(value);
    return data ? { data } : { error: "Проверьте реквизиты документа, дату, адрес и HTTPS-ссылку.", status: 400 };
}
