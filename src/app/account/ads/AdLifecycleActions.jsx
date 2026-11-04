"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ads.module.css";

const BUTTONS = {
    PUBLISHED: [
        { action: "pause", label: "Приостановить" },
        { action: "close", label: "Закрыть объявление" },
    ],
    PAUSED: [
        { action: "resume", label: "Возобновить" },
        { action: "close", label: "Закрыть объявление" },
    ],
    CLOSED: [{ action: "relist", label: "Разместить повторно" }],
    EXPIRED: [{ action: "relist", label: "Разместить повторно" }],
};

export default function AdLifecycleActions({ adId, status }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function perform(action) {
        if (busy) return;
        if (action === "close" &&
            !window.confirm("Закрыть объявление? Оно исчезнет из публичного каталога.")) {
            return;
        }

        setBusy(true);
        setError("");
        try {
            const response = await fetch(
                `/api/account/ads/${encodeURIComponent(adId)}`,
                {
                    method: "PATCH",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action }),
                }
            );
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Не удалось изменить статус объявления.");
            }
            if (action === "relist") {
                router.push(`/account/ads/${encodeURIComponent(adId)}/edit`);
            }
            router.refresh();
        } catch (err) {
            setError(err.message || "Не удалось выполнить действие.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={styles.lifecycleActions}>
            {(BUTTONS[status] ?? []).map(({ action, label }) => (
                <button
                    key={action}
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => perform(action)}
                >
                    {busy ? "Обрабатываем..." : label}
                </button>
            ))}
            {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
    );
}
