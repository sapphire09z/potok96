import { notFound } from "next/navigation";
import QaLoginClient from "./QaLoginClient";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Тестовый вход",
    robots: { index: false, follow: false },
};

export default function QaLoginPage() {
    if (
        process.env.STAGING_QA_LOGIN_ENABLED !== "true" ||
        process.env.AUTH_ALLOWED_ORIGIN !== "https://staging.potok96.ru" ||
        process.env.NODE_ENV !== "production"
    ) {
        notFound();
    }

    return (
        <div style={{ maxWidth: 520, margin: "50px auto", lineHeight: 1.6 }}>
            <p style={{ color: "#6f6a63", fontSize: 13 }}>Поток 96 / staging</p>
            <h1>Тестовый вход</h1>
            <QaLoginClient />
        </div>
    );
}
