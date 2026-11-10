"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./org-claims.module.css";

export default function OrgClaimForm({ organization }) {
    const router = useRouter();
    const [roleDescription, setRole] = useState("");
    const [evidenceNote, setEvidence] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    async function submit(event) {
        event.preventDefault();
        if (busy || done) return;
        setBusy(true); setError("");
        try {
            const response = await fetch("/api/account/org-claims", {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId: organization.id, roleDescription, evidenceNote }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            setDone(true);
            router.refresh();
        } catch (err) { setError(err.message || "Не удалось отправить заявку."); }
        finally { setBusy(false); }
    }

    return <form className={styles.panel} onSubmit={submit}>
        <h2>Заявка: {organization.title}</h2>
        <label>Ваша роль в организации
            <input value={roleDescription} onChange={e => setRole(e.target.value)} required minLength={4} maxLength={120}
                placeholder="Например, директор или управляющий" disabled={busy || done}/>
        </label>
        <label>Как редакция может проверить ваши полномочия?
            <textarea rows={4} value={evidenceNote} onChange={e => setEvidence(e.target.value)} required
                minLength={15} maxLength={1000} disabled={busy || done}
                placeholder="Укажите способ проверки, например обратный звонок на официальный телефон организации"/>
        </label>
        <p className={styles.help}>Заявка не подтверждает право владения автоматически. Не отправляйте паспортные данные, пароли и копии документов. Администратор проверит полномочия отдельно.</p>
        <button type="submit" disabled={busy || done}>{busy ? "Отправляем…" : done ? "Заявка отправлена" : "Отправить на проверку"}</button>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {done && <p role="status">Заявка получена. Дождитесь решения редакции.</p>}
    </form>;
}
