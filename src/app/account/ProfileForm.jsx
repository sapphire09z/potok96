"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./account.module.css";

const ROLES = {
    ADMIN: "Администратор",
    MODERATOR: "Модератор",
    USER: "Пользователь",
};

export default function ProfileForm({ profile, phone, role, userId }) {
    const router = useRouter();
    const [displayName, setDisplayName] = useState(profile.displayName || "");
    const [email, setEmail] = useState(profile.email || "");
    const [initial, setInitial] = useState({
        displayName: profile.displayName || "",
        email: profile.email || "",
        updatedAt: profile.updatedAt,
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const changed = displayName !== initial.displayName || email !== initial.email;

    async function save(event) {
        event.preventDefault();
        if (!changed || saving) return;
        setSaving(true);
        setMessage("");
        setError("");
        try {
            const response = await fetch("/api/account/profile", {
                method: "PATCH",
                credentials: "same-origin",
                cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    displayName,
                    email,
                    expectedUpdatedAt: initial.updatedAt,
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.success !== true || !result.profile) {
                throw new Error(result.error || `Ошибка ${response.status}`);
            }
            setInitial(result.profile);
            setDisplayName(result.profile.displayName);
            setEmail(result.profile.email);
            setMessage("Профиль сохранён.");
            router.refresh();
        } catch (err) {
            setError(err.message || "Не удалось сохранить изменения.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} className={styles.profileForm}>
            <div className={styles.profileGrid}>
                <label className={styles.profileField}>
                    <span>Имя для отображения</span>
                    <input name="displayName" type="text" autoComplete="name"
                        maxLength={80} placeholder="Как к вам обращаться"
                        value={displayName}
                        onChange={(event) => { setDisplayName(event.target.value); setMessage(""); }}
                        disabled={saving} />
                    <small>Необязательное поле, от 2 до 80 символов.</small>
                </label>
                <label className={styles.profileField}>
                    <span>Электронная почта</span>
                    <input name="email" type="email" autoComplete="email"
                        maxLength={254} placeholder="name@example.ru"
                        value={email}
                        onChange={(event) => { setEmail(event.target.value); setMessage(""); }}
                        disabled={saving} />
                    <small>E-mail пока не подтверждается и не используется для входа.</small>
                </label>
            </div>
            <div className={styles.profileReadonly}>
                <div>
                    <span>Подтверждённый телефон</span>
                    <strong>{phone || "Не указан"}</strong>
                    <small>Для изменения номера потребуется отдельная процедура подтверждения.</small>
                </div>
                <div>
                    <span>Роль</span>
                    <strong>{ROLES[role] || "Пользователь"}</strong>
                    <small>Назначается администратором.</small>
                </div>
            </div>
            <p className={styles.profileId}>ID аккаунта: <code>{userId}</code></p>
            <div className={styles.profileControls}>
                <button type="submit" disabled={!changed || saving}>
                    {saving ? "Сохраняем…" : "Сохранить изменения"}
                </button>
                {message && <span role="status" className={styles.profileSuccess}>{message}</span>}
                {error && <span role="alert" className={styles.profileError}>{error}</span>}
            </div>
        </form>
    );
}
