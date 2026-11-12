// Response policy for authenticated, read-only previews of private draft PDFs.
// A draft must never be cached or embedded by another origin.
export function draftPdfPreviewHeaders(byteLength) {
    if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength > 15 * 1024 * 1024)
        throw new RangeError("Invalid draft PDF length");
    return {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="official-document-draft.pdf"',
        "Content-Length": String(byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
    };
}
