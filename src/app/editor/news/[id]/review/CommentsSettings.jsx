"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./review.module.css";

export default function CommentsSettings({ postId, updatedAt, enabled }) {
    const router = useRouter();
    const [checked, setChecked] = useState(enabled);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function save() {
        if (busy || checked === enabled) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`/api/editor/news/${encodeURIComponent(postId)}/comments-settings`, {
                method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: checked, expectedUpdatedAt: updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            router.refresh();
        } catch (cause) { setError(cause.message || "Не удалось изменить настройки."); }
        finally { setBusy(false); }
    }
    return <section className={styles.commentSettings} aria-label="Настройки комментариев новости">
        <h2>Комментарии к новости</h2>
        <label className={styles.commentToggle}>
            <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={busy} />
            <span>Разрешить комментарии к этой новости</span>
        </label>
        <p>{checked ? "Читатели смогут отправлять сообщения на предварительную модерацию после выхода новости." :
            "Комментарии скрыты. Новые сообщения отправить нельзя, существующие сохраняются в базе."}</p>
        <button type="button" disabled={busy || checked === enabled} onClick={save}>
            {busy ? "Сохранение…" : "Сохранить настройку"}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
    </section>;
}
