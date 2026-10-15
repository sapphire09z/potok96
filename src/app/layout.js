import "./globals.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
    metadataBase: new URL("https://potok96.ru"),
    title: {
        default: "Поток 96",
        template: "%s — Поток 96",
    },
    description: "Городской портал Красноуфимска и района: новости, афиша, организации и объявления.",
    openGraph: {
        title: "Поток 96",
        description: "Городской портал Красноуфимска и района.",
        url: "https://potok96.ru",
        siteName: "Поток 96",
        locale: "ru_RU",
        type: "website",
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="ru">
        <body className="site-body">
        <Header />

        <main className="site-main">{children}</main>

        <Footer />
        </body>
        </html>
    );
}