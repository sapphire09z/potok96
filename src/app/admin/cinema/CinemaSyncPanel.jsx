"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./cinema-admin.module.css";

const stamp = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
});
const label = { QUEUED: "В очереди", RUNNING: "Выполняется", SUCCEEDED: "Успешно", PARTIAL: "С замечаниями", FAILED: "Ошибка" };
const active = status => status === "QUEUED" || status === "RUNNING";
const fmt = x => x ? stamp.format(new Date(x)) : "—";

export default function CinemaSyncPanel({ initialRuns }) {
    const [runs, setRuns] = useState(initialRuns);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const refresh = useCallback(async () => {
        try {
            const response = await fetch("/api/admin/cinema/sync", { cache: "no-store", credentials: "same-origin" });
            if (!response.ok) throw new Error("Не удалось обновить журнал. Попробуйте позднее.");
            const data = await response.json();
            if (Array.isArray(data.runs)) setRuns(data.runs);
        } catch (cause) { setError(cause.message); }
    }, []);
    useEffect(() => {
        const timer = setInterval(refresh, 10000);
        return () => clearInterval(timer);
    }, [refresh]);
    const busy = submitting || runs.some(run => active(run.status));
    async function start() {
        if (busy) return;
        setError(""); setSubmitting(true);
        try {
            const response = await fetch("/api/admin/cinema/sync", {
                method: "POST", credentials: "same-origin",
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Не удалось запустить обновление.");
            await refresh();
        } catch (cause) { setError(cause.message); }
        finally { setSubmitting(false); }
    }
    return <section className={styles.panel}>
        <div className={styles.actions}>
            <div>
                <h3>Управление синхронизацией</h3>
                <p>Фильмы, сеансы, цены и новые постеры обновляются вместе. Ручной запуск дополнительно проверяет все постеры.</p>
            </div>
            <button type="button" onClick={start} disabled={busy} className={styles.primary}>
                {submitting ? "Отправка…" : busy ? "Обновление запущено" : "Обновить сейчас"}
            </button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <h3>Последние обновления</h3>
        {!runs.length ? <p className={styles.hint}>Запусков пока нет. Служебный процесс создаст первую автоматическую задачу после запуска.</p> :
            <div className={styles.history}>{runs.map(run => <article className={styles.item} key={run.id}>
                <div className={styles.itemHeader}>
                    <strong>{run.trigger === "MANUAL" ? "Вручную" : "Автоматически"}</strong>
                    <span className={styles[run.status.toLowerCase()] ?? styles.queued}>{label[run.status] ?? run.status}</span>
                </div>
                <div className={styles.dates}>Создано: {fmt(run.createdAt)} · Завершено: {fmt(run.finishedAt)}</div>
                {run.movieCount !== null && <p>Фильмов: {run.movieCount} · Сеансов: {run.sessionCount} · Постеров обновлено: {run.posterUpdated ?? 0} · Без изменений: {(run.posterUnchanged ?? 0) + (run.posterSkipped ?? 0)}</p>}
                {run.error && <p className={styles.error}>{run.error}</p>}
            </article>)}</div>}
    </section>;
}
