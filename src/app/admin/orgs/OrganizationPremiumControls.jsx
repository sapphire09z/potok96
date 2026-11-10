"use client";

import { useEffect, useState } from "react";
import styles from "./orgs-admin.module.css";

const COLLECTIONS = [
    { key: "priceItems", title: "Услуги с ценами", max: 16,
        fields: [{ key: "title", label: "Название услуги", max: 120 },
            { key: "price", label: "Цена (например, от 500 ₽)", max: 80 },
            { key: "description", label: "Описание (необязательно)", max: 240 }] },
    { key: "specialOffers", title: "Специальные предложения", max: 3,
        fields: [{ key: "title", label: "Название предложения", max: 120 },
            { key: "description", label: "Условия предложения", max: 400 }] },
    { key: "extraLinks", title: "Дополнительные кнопки", max: 3,
        fields: [{ key: "label", label: "Текст кнопки", max: 50 },
            { key: "url", label: "Ссылка (HTTPS)", max: 2048 }] },
];

export default function OrganizationPremiumControls({ orgId, initialContent, version, disabled, onBusy, onDirty, onVersion, onUpdated }) {
    const [content, setContent] = useState(() => Object.fromEntries(COLLECTIONS.map(item =>
        [item.key, initialContent[item.key] ?? []])));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const changed = COLLECTIONS.some(item => JSON.stringify(content[item.key]) !== JSON.stringify(initialContent[item.key] ?? []));

    useEffect(() => { onDirty(changed); return () => onDirty(false); }, [changed, onDirty]);

    useEffect(() => {
        if (!changed) return;
        const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [changed]);

    function setField(key, index, field, value) {
        setContent(previous => ({ ...previous,
            [key]: previous[key].map((entry, position) => position === index ? { ...entry, [field]: value } : entry),
        }));
        setNotice(""); setError("");
    }
    function addItem(item) {
        setContent(previous => ({ ...previous,
            [item.key]: [...previous[item.key], Object.fromEntries(item.fields.map(field => [field.key, ""]))],
        }));
        setNotice(""); setError("");
    }
    function removeItem(key, index) {
        setContent(previous => ({ ...previous, [key]: previous[key].filter((_, pos) => pos !== index) }));
        setNotice(""); setError("");
    }

    async function save() {
        if (!changed || disabled || saving || !version) return;
        setSaving(true); onBusy(true); setError(""); setNotice("");
        try {
            const response = await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}/premium`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...content, expectedUpdatedAt: version }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
            onVersion(result.updatedAt);
            setNotice("Расширенные блоки сохранены.");
            onUpdated();
        } catch (err) {
            setError(err.message || "Не удалось сохранить расширенные блоки.");
        } finally {
            setSaving(false); onBusy(false);
        }
    }

    return <section className={styles.premiumPanel} aria-label="Расширенные возможности организации">
        <h3>Содержимое расширенной карточки</h3>
        <p className={styles.help}>Дополнительные блоки показываются только при действующем расширенном размещении. Их можно заполнить заранее; при истечении срока данные сохраняются, но посетителям не показываются. Изменения опубликованной карточки становятся видны сразу после сохранения.</p>
        {COLLECTIONS.map(item => <div key={item.key} className={styles.premiumGroup}>
            <h4>{item.title} ({content[item.key].length}/{item.max})</h4>
            {content[item.key].map((entry, index) => <div key={`${item.key}-${index}`} className={styles.premiumEntry}>
                {item.fields.map(field => <label key={field.key}>{field.label}
                    {field.key === "description" ? <textarea rows={2} maxLength={field.max} disabled={disabled || saving}
                        value={entry[field.key]} onChange={e => setField(item.key, index, field.key, e.target.value)} /> :
                        <input maxLength={field.max} disabled={disabled || saving}
                            value={entry[field.key]} onChange={e => setField(item.key, index, field.key, e.target.value)} />}
                </label>)}
                <div className={styles.premiumButtons}><button type="button" disabled={disabled || saving}
                    onClick={() => removeItem(item.key, index)}>Удалить</button></div>
            </div>)}
            {content[item.key].length < item.max && <div className={styles.premiumButtons}>
                <button type="button" disabled={disabled || saving} onClick={() => addItem(item)}>+ Добавить</button>
            </div>}
        </div>)}
        <button type="button" className={styles.primary} disabled={disabled || saving || !changed} onClick={save}>
            {saving ? "Сохраняем…" : "Сохранить расширенные блоки"}
        </button>
        {changed && <p className={styles.help}>Есть несохранённые изменения в расширенных блоках.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.success} role="status">{notice}</p>}
    </section>;
}
