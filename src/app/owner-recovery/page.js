import { notFound } from "next/navigation";
import OwnerRecoveryClient from "./OwnerRecoveryClient";

export const dynamic = "force-dynamic";
export const metadata = {
    title: "Восстановление входа — Поток 96",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
};

export default function OwnerRecoveryPage() {
    if (
        process.env.NODE_ENV !== "production" ||
        process.env.AUTH_ALLOWED_ORIGIN !== "https://staging.potok96.ru" ||
        process.env.STAGING_OWNER_RECOVERY_ENABLED !== "true" ||
        !/^\+7\d{10}$/.test(process.env.STAGING_OWNER_PHONE || "")
    ) {
        notFound();
    }

    return (
        <main style={{ maxWidth: 520, margin: "48px auto", padding: "0 20px 64px" }}>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Поток 96 / staging</p>
            <h1>Восстановление входа</h1>
            <p>Одноразовая ссылка доступна только владельцу. Срок действия — 5 минут.</p>
            <OwnerRecoveryClient />
        </main>
    );
}
