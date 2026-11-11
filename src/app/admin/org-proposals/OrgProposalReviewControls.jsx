"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./proposals.module.css";

export default function OrgProposalReviewControls({ proposalId, updatedAt, canApprove }) {
    const router = useRouter();
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function decide(action) {
        if (busy || note.trim().length < 10 || (action === "approve" && !canApprove)) return;
        const question = action === "approve" ? "Применить изменения к опубликованной организации?" :
            "Вернуть предложение представителю на доработку?";
        if (!window.confirm(question)) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`/api/admin/org-proposals/${encodeURIComponent(proposalId)}`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, note, expectedUpdatedAt: updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            setNote("");
            router.refresh();
        } catch (err) { setError(err.message || "Не удалось сохранить решение."); }
        finally { setBusy(false); }
    }
    return <section className={styles.panel} aria-label="Решение администратора">
        <h3>Решение редакции</h3>
        <label className={styles.noteLabel}>Причина решения / комментарий (обязательно, от 10 до 1000 символов)
            <textarea rows={3} maxLength={1000} value={note} disabled={busy}
                onChange={event => setNote(event.target.value)} placeholder="Что проверено или что нужно исправить?"/>
        </label>
        <div className={styles.buttons}>
            <button type="button" disabled={busy || note.trim().length < 10 || !canApprove}
                onClick={() => decide("approve")}>Одобрить и опубликовать</button>
            <button type="button" disabled={busy || note.trim().length < 10}
                onClick={() => decide("return")}>Вернуть на доработку</button>
        </div>
        {!canApprove && <p className={styles.warningText}>Одобрение недоступно: изменена исходная карточка, полномочия недействительны или предложение содержит ошибку.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
    </section>;
}
