"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./trash-button.module.css";

export default function TrashButton({ kind, id, updatedAt, title, disabled = false }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function move() {
        if (busy || disabled) return;
        const reason = window.prompt(`Переместить «${title}» в корзину?\nУкажите причину (минимум 5 символов).\nМатериал можно будет восстановить.`, "");
        if (reason === null) return;
        if (reason.trim().length < 5 || reason.trim().length > 500) {
            setError("Причина должна содержать от 5 до 500 символов."); return;
        }
        if (!window.confirm("Подтверждаете перемещение в корзину? Материал исчезнет из рабочих списков.")) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`/api/admin/trash/${kind}/${encodeURIComponent(id)}`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "trash", reason: reason.trim(), expectedUpdatedAt: updatedAt }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.error || `Ошибка ${response.status}`);
            router.push("/admin/trash");
            router.refresh();
        } catch (err) { setError(err.message || "Ошибка перемещения."); }
        finally { setBusy(false); }
    }
    return <span className={styles.wrap}>
        <button type="button" className={styles.button} onClick={move} disabled={busy || disabled}>
            {busy ? "Перемещение…" : "В корзину"}
        </button>
        {error && <span role="alert" className={styles.error}>{error}</span>}
    </span>;
}
