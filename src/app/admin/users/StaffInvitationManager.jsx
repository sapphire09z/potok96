"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../admin.module.css";

const fmt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Yekaterinburg",
});

function statusLabel(item) {
    if (item.consumedAt) return "Принято";
    if (item.revokedAt) return "Отозвано";
    if (new Date(item.expiresAt) <= new Date()) return "Истекло";
    return "Ожидает подтверждения";
}

export default function StaffInvitationManager({ invitations }) {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [busy, setBusy] = useState(false);
    const [revoking, setRevoking] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function add(event) {
        event.preventDefault();
        if (busy || revoking) return;
        if (!window.confirm("Пригласить указанный номер в редакцию как MODERATOR? Права включатся только после подтверждения номера через Mobile ID.")) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const response = await fetch("/api/admin/staff-invitations", {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            setPhone("");
            setMessage("Приглашение подготовлено. Сотруднику нужно подтвердить номер на странице входа.");
            router.refresh();
        } catch (err) {
            setError(err.message || "Не удалось создать приглашение.");
        } finally { setBusy(false); }
    }

    async function revoke(id, phoneValue) {
        if (busy || revoking) return;
        if (!window.confirm(`Отозвать приглашение для ${phoneValue}?`)) return;
        setRevoking(id); setError(""); setMessage("");
        try {
            const response = await fetch(`/api/admin/staff-invitations/${encodeURIComponent(id)}`, {
                method: "DELETE", credentials: "same-origin", cache: "no-store",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            setMessage("Приглашение отозвано.");
            router.refresh();
        } catch (err) {
            setError(err.message || "Не удалось отозвать приглашение.");
        } finally { setRevoking(""); }
    }

    return <section className={styles.panel} aria-labelledby="staff-invites-title">
        <h2 id="staff-invites-title">Приглашение модераторов</h2>
        <p className={styles.muted}>Добавь телефон помощника. Роль MODERATOR назначится автоматически только после подтверждения номера через SMS Aero Mobile ID. Срок ожидания — 7 дней. QA-аккаунты не переименовываются.</p>
        <form onSubmit={add} className={styles.staffInviteForm}>
            <label>Номер телефона сотрудника
                <input type="tel" autoComplete="off" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+7 999 123-45-67" maxLength={40} required disabled={busy || !!revoking} />
            </label>
            <button type="submit" disabled={busy || !!revoking || !phone.trim()}>
                {busy ? "Создаём…" : "Пригласить модератора"}
            </button>
        </form>
        {message && <p role="status" className={styles.success}>{message}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.staffInviteList}>
            {invitations.length === 0 ? <p className={styles.muted}>Приглашений пока нет.</p> :
                invitations.map(item => {
                    const active = !item.consumedAt && !item.revokedAt && new Date(item.expiresAt) > new Date();
                    return <div className={styles.staffInviteRow} key={item.id}>
                        <div>
                            <strong>{item.phone}</strong>
                            <small>{statusLabel(item)} · До {fmt.format(new Date(item.expiresAt))}</small>
                        </div>
                        {active && <button type="button" disabled={busy || !!revoking}
                            onClick={() => revoke(item.id, item.phone)}>
                            {revoking === item.id ? "Отзываем…" : "Отозвать"}
                        </button>}
                    </div>;
                })}
        </div>
    </section>;
}
