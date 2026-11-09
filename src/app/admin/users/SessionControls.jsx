"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../admin.module.css";

export default function SessionControls({ userId, role, updatedAt, activeCount, isSelf }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const otherCount = Math.max(0, activeCount - (isSelf ? 1 : 0));
    const disabled = busy || (isSelf ? otherCount === 0 : activeCount === 0);

    async function revoke() {
        if (disabled) return;
        const message = isSelf
            ? `Завершить остальные сеансы и неиспользованные одноразовые ссылки своего аккаунта? Текущий вход останется активным.`
            : `Отозвать все неистёкшие сессии и одноразовые ссылки выбранного пользователя? Для повторного входа ему потребуется авторизация.`;
        if (!window.confirm(message)) return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/sessions`, {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expectedRole: role, expectedUpdatedAt: updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            setNotice(`Отозвано записей: ${result.revoked}.`);
            router.refresh();
        } catch (err) {
            setError(err.message || "Не удалось завершить сессии.");
        } finally {
            setBusy(false);
        }
    }

    return <section className={styles.sessionControls} aria-label="Управление сессиями">
        <span>Неистёкших записей доступа: <strong>{activeCount}</strong></span>
        <button type="button" disabled={disabled} onClick={revoke}>
            {busy ? "Завершаем…" : isSelf ? "Завершить другие" : "Завершить все сессии"}
        </button>
        {isSelf && <small>Текущая сессия сохранится.</small>}
        {error && <small role="alert" className={styles.error}>{error}</small>}
        {notice && <small role="status" className={styles.success}>{notice}</small>}
    </section>;
}
