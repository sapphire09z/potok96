import test from "node:test";
import { draftPdfPreviewHeaders } from "../src/lib/media/officialDocumentPreviewHeaders.mjs";
import assert from "node:assert/strict";
import {
    validateOfficialDocument, DOCUMENT_ID, isValidPdf, validPdfUploadFile,
    PDF_MAX_BYTES, validDocumentVersion,
} from "../src/lib/officialDocumentValidation.mjs";

const valid = {
    slug: "postanovlenie-123", title: "Постановление о благоустройстве", type: "Постановление",
    number: "123", date: "2026-11-12", issuer: "Администрация", description: "Проверенный документ",
    sourceUrl: "https://example.org/official/123",
};
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "ascii");

test("valid metadata is normalized and accepted", () => {
    const result = validateOfficialDocument({ ...valid, title: `  ${valid.title}  ` });
    assert.equal(result.title, valid.title);
    assert.equal(result.slug, valid.slug);
});
test("rejects malformed and excess fields", () => {
    assert.equal(validateOfficialDocument({ ...valid, unexpected: "yes" }), null);
    assert.equal(validateOfficialDocument(Object.fromEntries(Object.entries(valid).slice(1))), null);
    assert.equal(validateOfficialDocument(null), null);
    assert.equal(validateOfficialDocument([]), null);
});
test("rejects invalid slug and impossible dates", () => {
    for (const slug of ["A-B", "hello/123", "a", "hello--world", "hello world"])
        assert.equal(validateOfficialDocument({ ...valid, slug }), null);
    for (const date of ["2026-02-30", "2026-13-01", "not-a-date", "1899-01-01"])
        assert.equal(validateOfficialDocument({ ...valid, date }), null);
    assert.ok(validateOfficialDocument({ ...valid, date: "2024-02-29" }));
});
test("forbids unsafe links, credentials and control characters", () => {
    for (const sourceUrl of ["http://example.org", "javascript:alert(1)", "https://x:y@example.org"])
        assert.equal(validateOfficialDocument({ ...valid, sourceUrl }), null);
    assert.equal(validateOfficialDocument({ ...valid, title: "A\nB" }), null);
    assert.equal(validateOfficialDocument({ ...valid, issuer: "A\u202EB" }), null);
});
test("enforces field limits and permits multiline description", () => {
    assert.equal(validateOfficialDocument({ ...valid, description: "x".repeat(10001) }), null);
    assert.ok(validateOfficialDocument({ ...valid, description: "Первый абзац\nВторой абзац" }));
});
test("enforces optimistic version policy and ID format", () => {
    assert.equal(validDocumentVersion("2026-11-12T07:00:00.000Z"), true);
    assert.equal(validDocumentVersion("2026-11-12"), false);
    assert.equal(DOCUMENT_ID.test("c" + "a".repeat(24)), true);
    assert.equal(DOCUMENT_ID.test("../secrets"), false);
});
test("accepts PDF signature and EOF, rejects polyglot/text", () => {
    assert.equal(isValidPdf(pdf), true);
    assert.equal(isValidPdf(Buffer.from("not a PDF %%EOF")), false);
    assert.equal(isValidPdf(Buffer.from("%PDF-1.7\nno trailer")), false);
    assert.equal(isValidPdf(Buffer.from("%PDF-3.0\n%%EOF\n")), false);
});
test("validates upload size, extension and browser MIME", () => {
    const mock = (name, type, size) => ({ name, type, size, arrayBuffer: async () => pdf });
    assert.ok(validPdfUploadFile(mock("act.PDF", "application/pdf", pdf.length)));
    assert.ok(!validPdfUploadFile(mock("act.exe", "application/pdf", pdf.length)));
    assert.ok(!validPdfUploadFile(mock("act.pdf", "text/html", pdf.length)));
    assert.ok(!validPdfUploadFile(mock("act.pdf", "application/pdf", PDF_MAX_BYTES + 1)));
});

test("private draft PDF can be viewed inline but must not be cached or framed", () => {
    const h = draftPdfPreviewHeaders(4096);
    assert.equal(h["Content-Type"], "application/pdf");
    assert.match(h["Content-Disposition"], /^inline;/);
    assert.match(h["Cache-Control"], /no-store/);
    assert.equal(h["Cross-Origin-Resource-Policy"], "same-origin");
    assert.equal(h["X-Frame-Options"], "DENY");
    assert.equal(h["Content-Length"], "4096");
});
test("private preview rejects invalid PDF lengths", () => {
    for (const size of [0, -1, Number.NaN, 15 * 1024 * 1024 + 1])
        assert.throws(() => draftPdfPreviewHeaders(size), RangeError);
});
