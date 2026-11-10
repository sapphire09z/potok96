"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../admin.module.css";

export default function ArchiveControls({ userId, role, updatedAt, archived, isSelf }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const action = archived ? "restore" : "archive";
    const disabled = busy || isSelf || (!archived && role === "ADMIN");

    async function changeStatus() {
        if (disabled) return;
        const message = archived
            ? "Восстановить учётную запись? Её прежняя роль снова станет действующей после входа."
            : "Архивировать учётную запись? Все её сессии будут отозваны. Новости и история действий сохранятся.";
        if (!window.confirm(message)) return;
        setBusy(true);
        setNotice("");
        setError("");
        try {
            const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/archive`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, expectedUpdatedAt: updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            setNotice(archived ? "Аккаунт восстановлен." : `Аккаунт архивирован. Отозвано записей доступа: ${result.revoked}.`);
            router.refresh();
        } catch (err) {
            setError(err.message || "Не удалось изменить состояние аккаунта.");
        } finally {
            setBusy(false);
        }
    }

    return <section className={styles.archiveControls} aria-label="Архивирование аккаунта">
        <button type="button" disabled={disabled} onClick={changeStatus}>
            {busy ? "Обрабатываем…" : archived ? "Восстановить аккаунт" : "Архивировать аккаунт"}
        </button>
        {isSelf && <small>Свой аккаунт архивировать нельзя.</small>}
        {!archived && role === "ADMIN" && !isSelf && <small>Сначала снимите роль администратора.</small>}
        {error && <small role="alert" className={styles.error}>{error}</small>}
        {notice && <small role="status" className={styles.success}>{notice}</small>}
    </section>;
}
