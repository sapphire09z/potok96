"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../admin.module.css";

const ROLES = [
    { value: "USER", label: "Пользователь" },
    { value: "MODERATOR", label: "Модератор" },
    { value: "ADMIN", label: "Администратор" },
];

export default function RoleEditor({ userId, role, updatedAt, isSelf }) {
    const router = useRouter();
    const [desired, setDesired] = useState(role);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function changeRole() {
        if (busy || isSelf || desired === role) return;
        const roleLabel = ROLES.find((item) => item.value === desired)?.label;
        if (!window.confirm(`Изменить роль пользователя на «${roleLabel}»? Доступ изменится для его действующих сессий.`)) return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
                method: "POST", credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: desired, expectedRole: role, expectedUpdatedAt: updatedAt }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || `Ошибка ${response.status}`);
            setNotice("Роль изменена.");
            router.refresh();
        } catch (err) {
            setError(err.message || "Не удалось изменить роль.");
        } finally {
            setBusy(false);
        }
    }

    return <div className={styles.roleEditor}>
        <label>Роль
            <select aria-label="Роль пользователя" value={desired} disabled={busy || isSelf}
                onChange={(event) => { setDesired(event.target.value); setError(""); setNotice(""); }}>
                {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
        </label>
        <button type="button" disabled={busy || isSelf || desired === role} onClick={changeRole}>
            {busy ? "Сохраняем…" : "Изменить роль"}
        </button>
        {isSelf && <small>Свою роль менять нельзя.</small>}
        {error && <small role="alert" className={styles.error}>{error}</small>}
        {notice && <small role="status" className={styles.success}>{notice}</small>}
    </div>;
}
