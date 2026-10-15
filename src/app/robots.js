
export default function robots() {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/menu", "/admin"],
        },
        sitemap: "https://potok96.ru/sitemap.xml",
    };
}
