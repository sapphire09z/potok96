"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./review.module.css";

export default function FeaturedActions({ postId, updatedAt, featured, featuredOrder }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function act(action) {
        if (busy) return;
        const message = action === "feature"
            ? "Поставить эту новость первой в главной карусели?"
            : "Убрать новость из главной карусели? Она останется опубликованной.";
        if (!window.confirm(message)) return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch(`/api/editor/news/${encodeURIComponent(postId)}/featured`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, expectedUpdatedAt: updatedAt }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            router.refresh();
        } catch (cause) {
            setError(cause.message || "Не удалось изменить главные новости.");
        } finally {
            setBusy(false);
        }
    }

    return <section className={styles.featurePanel} aria-label="Главные новости">
        <h2>Главные новости</h2>
        <p>{featured
            ? `Материал выбран для карусели (позиция ${featuredOrder}). Можно поднять его на первое место или убрать из подборки.`
            : "Материал опубликован в ленте. По решению редакции его можно поставить первым в карусели на главной странице."}</p>
        <p className={styles.featureHint}>В карусели максимум три новости. При добавлении четвёртой самая старая из выбранных выходит из подборки, но остаётся на сайте.</p>
        <div className={styles.featureButtons}>
            <button type="button" disabled={busy} onClick={() => act("feature")}>
                {featured ? "Поднять на первое место" : "Сделать главной"}
            </button>
            {featured && <button type="button" className={styles.secondaryButton} disabled={busy}
                onClick={() => act("unfeature")}>Убрать из главных</button>}
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>;
}
