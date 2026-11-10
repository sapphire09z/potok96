"use client";

import { useState } from "react";
import { isExtendedPlacement, placementDateInYekat } from "@/lib/orgPlacement";
import styles from "./orgs-admin.module.css";

export default function OrganizationPlacementControls({
    orgId, initialPlacement, initialExtendedUntil, version,
    disabled, onBusy, onVersion, onUpdated,
}) {
    const [placement, setPlacement] = useState(initialPlacement ?? "BASIC");
    const initialDay = placementDateInYekat(initialExtendedUntil);
    const [untilDate, setUntilDate] = useState(initialDay);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const active = isExtendedPlacement({ placement: initialPlacement, extendedUntil: initialExtendedUntil });
    const changed = placement !== initialPlacement ||
        (placement === "EXTENDED" && untilDate !== initialDay);
    const currentDay = placementDateInYekat(new Date());

    async function save() {
        if (saving || disabled || !changed || !version ||
            (placement === "EXTENDED" && !untilDate)) return;
        setSaving(true);
        onBusy(true);
        setError(""); setMessage("");
        try {
            const response = await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}/placement`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ placement,
                    untilDate: placement === "EXTENDED" ? untilDate : "",
                    expectedUpdatedAt: version }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            onVersion(result.updatedAt);
            setMessage("Тип размещения сохранён.");
            onUpdated();
        } catch (err) {
            setError(err.message || "Не удалось сохранить размещение.");
        } finally {
            setSaving(false);
            onBusy(false);
        }
    }

    return <section className={styles.placementPanel} aria-label="Условия размещения организации">
        <h3>Тип размещения</h3>
        <p className={styles.help}>Внутренняя настройка администратора. Платежей и платных функций пока нет; публикация карточки не меняется.</p>
        <div className={styles.placementChoices} role="radiogroup" aria-label="Тип карточки">
            <label><input type="radio" name={`placement-${orgId}`} value="BASIC"
                checked={placement === "BASIC"} disabled={disabled || saving}
                onChange={() => { setPlacement("BASIC"); setError(""); }} /> Обычная</label>
            <label><input type="radio" name={`placement-${orgId}`} value="EXTENDED"
                checked={placement === "EXTENDED"} disabled={disabled || saving}
                onChange={() => { setPlacement("EXTENDED"); setError(""); }} /> Расширенная</label>
        </div>
        {placement === "EXTENDED" && <label className={styles.placementDate}>Действует до (включительно, Красноуфимск)
            <input type="date" value={untilDate} min={currentDay}
                disabled={disabled || saving} onChange={event => { setUntilDate(event.target.value); setError(""); }} />
        </label>}
        <p className={styles.help} role="status">
            {initialPlacement === "EXTENDED"
                ? active ? `Расширенные возможности активны до ${initialDay} включительно.`
                    : `Срок расширенного размещения истёк${initialDay ? ` (${initialDay})` : ""}. Применяется обычная карточка.`
                : "Сейчас действует обычная карточка."}
        </p>
        <button type="button" className={styles.secondary} disabled={disabled || saving || !changed ||
            (placement === "EXTENDED" && !untilDate)} onClick={save}>
            {saving ? "Сохраняем…" : "Сохранить тип размещения"}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {message && <p className={styles.success} role="status">{message}</p>}
    </section>;
}
