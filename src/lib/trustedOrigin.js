
export function hasTrustedOrigin(request) {
    const expectedOrigin = process.env.AUTH_ALLOWED_ORIGIN;
    const actualOrigin = request.headers.get("origin");

    if (!expectedOrigin || !actualOrigin) {
        return false;
    }

    return actualOrigin === expectedOrigin;
}
