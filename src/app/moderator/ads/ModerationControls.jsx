
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./moderator.module.css";

export default function ModerationControls({ adId }) {
    const router = useRouter();
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit(action) {
        if (busy) return;

        if (
            action === "reject" &&
            (reason.trim().length < 10 ||
                reason.trim().length > 500)
        ) {
            setError("Причина должна содержать от 10 до 500 символов.");
            return;
        }

        setBusy(true);
        setError("");

        try {
            const response = await fetch(
                `/api/moderator/ads/${encodeURIComponent(adId)}`,
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action,
                        reason: action === "reject" ? reason.trim() : "",
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Не удалось обработать объявление."
                );
            }

            router.refresh();
        } catch (err) {
            setError(err.message || "Ошибка модерации.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={styles.controls}>
            <label htmlFor={`reason-${adId}`}>
                Причина отклонения
            </label>

            <textarea
                id={`reason-${adId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Что необходимо исправить автору?"
                maxLength={500}
                rows={3}
            />

            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}

            <div className={styles.actions}>
                <button
                    type="button"
                    onClick={() => submit("approve")}
                    disabled={busy}
                    className={styles.approve}
                >
                    {busy ? "Обрабатываем..." : "Опубликовать"}
                </button>

                <button
                    type="button"
                    onClick={() => submit("reject")}
                    disabled={busy}
                    className={styles.reject}
                >
                    Отклонить
                </button>
            </div>
        </div>
    );
}
