import "./globals.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
    title: "Поток 96",
    description: "Городской портал Красноуфимска и района",
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