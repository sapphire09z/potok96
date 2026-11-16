"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./comments.module.css";

export function CommentForm({ slug, parentId = null }) {
    const router = useRouter();
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    async function submit(event) {
        event.preventDefault();
        if (busy || !body.trim()) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const response = await fetch(`/api/news/${encodeURIComponent(slug)}/comments`, {
                method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body, ...(parentId ? { parentId } : {}) }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            setBody("");
            setMessage("Комментарий отправлен на модерацию.");
            router.refresh();
        } catch (cause) { setError(cause.message || "Не удалось отправить комментарий."); }
        finally { setBusy(false); }
    }
    return <form className={styles.form} onSubmit={submit}>
        <label htmlFor={`comment-${parentId || "new"}`}>{parentId ? "Ответить на комментарий" : "Оставить комментарий"}</label>
        <textarea id={`comment-${parentId || "new"}`} rows={parentId ? 2 : 4} maxLength={1000} required
            value={body} onChange={event => { setBody(event.target.value); setError(""); setMessage(""); }}
            placeholder="Напишите ваше мнение (от 2 до 1000 символов)…" disabled={busy} />
        <div className={styles.formBottom}><small>Новые сообщения проверяет модератор.</small>
            <button type="submit" disabled={busy || body.trim().length < 2}>{busy ? "Отправляем…" : "Отправить"}</button>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {message && <p role="status" className={styles.success}>{message}</p>}
    </form>;
}

export function CommentControls({ commentId, canDelete, canReport }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    async function request(url, method, payload) {
        setBusy(true); setMessage("");
        try {
            const response = await fetch(url, { method, credentials: "same-origin",
                ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}) });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            setMessage(method === "DELETE" ? "Комментарий удалён." : "Жалоба отправлена.");
            if (method === "POST") { setReportOpen(false); setReportReason(""); }
            router.refresh();
        } catch (cause) { setMessage(cause.message || "Не удалось выполнить действие."); }
        finally { setBusy(false); }
    }
    return <div className={styles.controls}>
        {canDelete && <button type="button" disabled={busy} onClick={() => {
            if (window.confirm("Удалить ваш комментарий? Это действие необратимо.")) {
                request(`/api/news-comments/${commentId}`, "DELETE");
            }
        }}>Удалить</button>}
        {canReport && <button type="button" disabled={busy} onClick={() => setReportOpen(value => !value)}>Пожаловаться</button>}
        {reportOpen && <div className={styles.reportForm}>
            <label htmlFor={`report-${commentId}`}>Причина жалобы</label>
            <textarea id={`report-${commentId}`} rows={2} maxLength={500} value={reportReason}
                disabled={busy} placeholder="Укажите причину (от 5 символов)…"
                onChange={event => setReportReason(event.target.value)} />
            <button type="button" disabled={busy || reportReason.trim().length < 5}
                onClick={() => request(`/api/news-comments/${commentId}/report`, "POST", { reason: reportReason })}>
                Отправить жалобу
            </button>
        </div>}
        {message && <span role="status">{message}</span>}
    </div>;
}
