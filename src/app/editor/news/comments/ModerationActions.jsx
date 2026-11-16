"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./comments-editor.module.css";

export default function ModerationActions({ commentId, status, updatedAt }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [note, setNote] = useState("");
    async function act(action) {
        if (busy) return;
        if (action !== "approve" && note.trim().length < 5) {
            setError("Для отклонения или скрытия укажите причину не менее 5 символов."); return;
        }
        const text = { approve: "одобрить", reject: "отклонить", hide: "скрыть" }[action];
        if (!window.confirm(`Действительно ${text} комментарий?`)) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`/api/editor/news-comments/${commentId}`, {
                method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, note, expectedUpdatedAt: updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            router.refresh();
        } catch (cause) { setError(cause.message || "Не удалось обработать сообщение."); }
        finally { setBusy(false); }
    }
    return <div className={styles.actions}>
        {status !== "APPROVED" && <button type="button" disabled={busy} onClick={() => act("approve")}>Одобрить</button>}
        {status === "PENDING" && <button type="button" disabled={busy || note.trim().length < 5}
            onClick={() => act("reject")}>Отклонить</button>}
        {status === "APPROVED" && <button type="button" disabled={busy || note.trim().length < 5}
            onClick={() => act("hide")}>Скрыть</button>}
        <label>Причина отклонения или скрытия
            <textarea rows={2} maxLength={500} value={note} disabled={busy}
                placeholder="Причина решения (от 5 символов)…" onChange={e => setNote(e.target.value)} />
        </label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>;
}
