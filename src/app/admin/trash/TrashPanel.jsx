"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./trash.module.css";

const dates = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short",
});

function RestoreButton({ item }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function restore() {
        if (busy || !window.confirm(`Восстановить «${item.title}» в черновики? Материал не будет опубликован автоматически.`)) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`/api/admin/trash/${item.kind}/${encodeURIComponent(item.id)}`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "restore", expectedUpdatedAt: item.updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            router.refresh();
        } catch (err) { setError(err.message || "Не удалось восстановить материал."); }
        finally { setBusy(false); }
    }
    return <div className={styles.restore}>
        <button type="button" disabled={busy} onClick={restore}>
            {busy ? "Восстановление…" : "Восстановить в черновики"}
        </button>
        {error && <span role="alert" className={styles.error}>{error}</span>}
    </div>;
}

export default function TrashPanel({ items }) {
    if (items.length === 0) return <p className={styles.empty}>Корзина по выбранному фильтру пуста.</p>;
    return <section className={styles.list} aria-label="Материалы в корзине">
        {items.map(item => <article key={`${item.kind}:${item.id}`} className={styles.item}>
            <div className={styles.details}>
                <p className={styles.meta}>{item.kind === "news" ? "Новость" : "Мероприятие"}
                    {" · "}Перемещено {dates.format(new Date(item.trashedAt))}</p>
                <h3>{item.title}</h3>
                <p className={styles.meta}>/{item.slug} · ID: {item.id}</p>
                <p className={styles.meta}>30 дней истекают {dates.format(new Date(item.eligibleAt))}.
                    Фактическое удаление в этом этапе отключено.</p>
            </div>
            <RestoreButton item={item} />
        </article>)}
    </section>;
}
