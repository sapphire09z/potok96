"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./review.module.css";

export default function ReviewActions({ postId, status, updatedAt, isAdmin }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    async function execute(action) {
        if (busy) return;
        const description = { submit: "отправить на проверку", approve: "одобрить", return: "вернуть на доработку", reopen: "вернуть в черновики" }[action];
        if (!window.confirm(`Действительно ${description} этот материал?`)) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`/api/editor/news/${encodeURIComponent(postId)}/workflow`, {
                method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason, expectedUpdatedAt: updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            setReason("");
            router.refresh();
        } catch (err) { setError(err.message || "Не удалось изменить статус."); }
        finally { setBusy(false); }
    }

    return <section className={styles.actions} aria-label="Редакционное решение">
        {status === "DRAFT" && <>
            <p>Сначала сохраните все изменения в редакторе. Отправленный материал станет недоступен для редактирования до возврата.</p>
            <button type="button" disabled={busy} onClick={() => execute("submit")}>Отправить на проверку</button>
        </>}
        {status === "REVIEW" && !isAdmin && <p>Материал ожидает решения администратора.</p>}
        {status === "REVIEW" && isAdmin && <>
            <p>Перед одобрением проверьте текст, источник, права на фотографии и корректность ссылок. Одобрение пока не публикует статью на сайте.</p>
            <button type="button" disabled={busy} onClick={() => execute("approve")}>Одобрить для публикации</button>
            <label>Причина возврата на доработку (не менее 5 символов)
                <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Что исправить в материале…" />
            </label>
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("return")}>Вернуть на доработку</button>
        </>}
        {status === "APPROVED" && <>
            <p>Материал одобрен. Публикацию на сайте подключим на следующем этапе.</p>
            {isAdmin && <>
                <label>Причина возврата в черновики
                    <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("reopen")}>Вернуть в черновики</button>
            </>}
        </>}
        {!["DRAFT", "REVIEW", "APPROVED"].includes(status) && <p>Материал уже прошёл следующий этап редакционного процесса.</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>;
}
