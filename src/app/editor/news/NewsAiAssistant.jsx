"use client";

import { useEffect, useState } from "react";
import styles from "./draft-form.module.css";

const fields = [
    { key: "title", label: "Заголовок" },
    { key: "summary", label: "Анонс" },
    { key: "body", label: "Текст новости" },
];

function fingerprint(value) {
    return JSON.stringify({ title: value.title, summary: value.summary, body: value.body });
}

export default function NewsAiAssistant({ draft, disabled, onApply }) {
    const [enabled, setEnabled] = useState(false);
    const [maxBodyLength, setMaxBodyLength] = useState(10000);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [selected, setSelected] = useState({ title: true, summary: true, body: true });

    useEffect(() => {
        let cancelled = false;
        fetch("/api/editor/news/ai", { credentials: "same-origin", cache: "no-store" })
            .then(async (response) => response.ok ? response.json() : {})
            .then((data) => {
                if (cancelled) return;
                setEnabled(data.enabled === true);
                if (Number.isInteger(data.maxBodyLength)) setMaxBodyLength(data.maxBodyLength);
            })
            .catch(() => { if (!cancelled) setEnabled(false); })
            .finally(() => { if (!cancelled) setLoadingConfig(false); });
        return () => { cancelled = true; };
    }, []);

    const sourceChanged = Boolean(result && result.fingerprint !== fingerprint(draft));
    const changed = result ? fields.filter((field) => result.suggestion[field.key] !== result.source[field.key]) : [];
    const chosen = changed.filter((field) => selected[field.key]);

    async function requestHelp(mode) {
        if (busy || disabled || !enabled || !draft.title.trim()) return;
        if (draft.body.length > maxBodyLength) {
            setError(`Для одной проверки допускается до ${maxBodyLength} символов текста. Разделите большой материал.`);
            return;
        }
        setBusy(true);
        setResult(null);
        setError("");
        const source = { title: draft.title, summary: draft.summary, body: draft.body };
        try {
            const response = await fetch("/api/editor/news/ai", {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...source, mode }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.suggestion) throw new Error(data.error || `Ошибка ${response.status}`);
            setResult({ suggestion: data.suggestion, source, fingerprint: fingerprint(source) });
            setSelected({ title: true, summary: true, body: true });
        } catch (err) {
            setError(err.message || "Не удалось проверить текст.");
        } finally {
            setBusy(false);
        }
    }

    function accept() {
        if (!result || sourceChanged || disabled || busy || chosen.length === 0) return;
        const replacements = Object.fromEntries(chosen.map(({ key }) => [key, result.suggestion[key]]));
        onApply(replacements);
        setResult(null);
        setError("");
    }

    return <section className={styles.aiPanel} aria-labelledby="news-ai-title">
        <h2 id="news-ai-title">ИИ-помощник редактора</h2>
        <p className={styles.hint}>По запросу отправляет только заголовок, анонс и текст внешнему ИИ-провайдеру. Не отправляйте персональные данные, служебную информацию и материалы ДСП. Все исправления сначала показываются для проверки; автоматически ничего не публикуется.</p>
        {loadingConfig ? <p className={styles.hint}>Проверяем доступность ИИ…</p> : !enabled ? (
            <p className={styles.hint} role="status">ИИ пока не подключён. Администратору нужно настроить провайдера и ключ на сервере.</p>
        ) : (
            <div className={styles.aiButtons}>
                <button type="button" disabled={busy || disabled || !draft.title.trim()}
                    onClick={() => requestHelp("proofread")}>{busy ? "Проверяем…" : "Проверить ошибки"}</button>
                <button type="button" disabled={busy || disabled || !draft.title.trim()}
                    onClick={() => requestHelp("style")}>Предложить улучшения стиля</button>
            </div>
        )}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {result && <div className={styles.aiResults}>
            <h3>Предложения ИИ</h3>
            {result.suggestion.comment && <p className={styles.hint}>{result.suggestion.comment}</p>}
            {changed.length === 0 ? <p className={styles.hint}>ИИ не предложил изменений.</p> : (
                <>
                    {changed.map(({ key, label }) => <div key={key} className={styles.aiResult}>
                        <label className={styles.aiSelect}>
                            <input type="checkbox" checked={selected[key]}
                                onChange={(event) => setSelected((prev) => ({ ...prev, [key]: event.target.checked }))} />
                            Применить: {label}
                        </label>
                        <div className={styles.aiComparison}>
                            <div><strong>Было</strong><pre>{result.source[key] || "(пусто)"}</pre></div>
                            <div><strong>Предлагается</strong><pre>{result.suggestion[key] || "(пусто)"}</pre></div>
                        </div>
                    </div>)}
                    {sourceChanged && <p role="alert" className={styles.error}>После проверки исходный текст изменился. Чтобы избежать перезаписи правок, запустите ИИ повторно.</p>}
                    <div className={styles.aiButtons}>
                        <button type="button" disabled={sourceChanged || disabled || busy || chosen.length === 0}
                            onClick={accept}>Принять выбранные исправления</button>
                        <button type="button" onClick={() => setResult(null)}>Отклонить все</button>
                    </div>
                </>
            )}
        </div>}
    </section>;
}
