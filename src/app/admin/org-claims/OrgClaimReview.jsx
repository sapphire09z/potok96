"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./claims.module.css";

export default function OrgClaimReview({ claimId, status }) {
    const router = useRouter();
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function decide(action) {
        if (busy || note.trim().length < 10) return;
        const labels = { approve: "Одобрить доступ представителя", reject: "Отклонить заявку", revoke: "Отозвать доступ представителя" };
        if (!window.confirm(`${labels[action]}? Действие будет записано в журнал заявки.`)) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`/api/admin/org-claims/${encodeURIComponent(claimId)}`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reviewNote: note }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            setNote(""); router.refresh();
        } catch (err) { setError(err.message || "Не удалось сохранить решение."); }
        finally { setBusy(false); }
    }

    return <div className={styles.review}>
        <label>{status === "APPROVED" ? "Основание отзыва доступа" : "Способ независимой проверки / причина отказа"}
            <textarea rows={2} value={note} maxLength={500} onChange={e => setNote(e.target.value)} disabled={busy}
                placeholder={status === "APPROVED" ? "Укажите причину отзыва доступа" : "Например: обратный звонок на опубликованный телефон организации"}/>
        </label>
        <div className={styles.buttons}>
            {status === "PENDING" && <>
                <button type="button" disabled={busy || note.trim().length < 10} onClick={() => decide("approve")}>Подтвердить полномочия</button>
                <button type="button" disabled={busy || note.trim().length < 10} onClick={() => decide("reject")}>Отклонить</button>
            </>}
            {status === "APPROVED" && <button type="button" disabled={busy || note.trim().length < 10} onClick={() => decide("revoke")}>Отозвать доступ</button>}
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>;
}
