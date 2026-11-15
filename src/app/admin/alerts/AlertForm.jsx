"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toYekaterinburgInput, isServiceAlertPublicationReady, validateServiceAlert } from "@/lib/serviceAlertValidation.mjs";
import styles from "../official/notices/official-notices.module.css";
import local from "./alert-form.module.css";

const empty = {
    slug: "", title: "", service: "water", state: "planned", urgency: "normal",
    confirmed: false, startAt: "", expectedEndAt: "", restoredAt: "", addresses: "",
    source: "", sourceUrl: "", content: "",
};
const dateFields = new Set(["startAt", "expectedEndAt", "restoredAt"]);
function formInitial(initial) {
    if (!initial) return { ...empty };
    return Object.fromEntries(Object.keys(empty).map(key => [key,
        dateFields.has(key) ? toYekaterinburgInput(initial[key]) : (initial[key] ?? empty[key]),
    ]));
}
const serviceNames = {
    water: "Водоснабжение", electricity: "Электроснабжение", gas: "Газоснабжение",
    heating: "Отопление", other: "Другие городские службы",
};
const stateNames = { planned: "Запланировано", active: "Действует", restored: "Восстановлено" };

export default function AlertForm({ initial }) {
    const router = useRouter();
    const [form, setForm] = useState(() => formInitial(initial));
    const [status, setStatus] = useState(initial?.status ?? "DRAFT");
    const [version, setVersion] = useState(initial?.updatedAt ?? "");
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    useEffect(() => {
        if (!dirty) return;
        const warn = event => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);
    function update(key, value) {
        setForm(prev => ({ ...prev, [key]: value,
            ...(key === "state" && value !== "restored" ? { restoredAt: "" } : {}),
        }));
        setDirty(true); setError(""); setMessage("");
    }
    async function send(url, method, body, headers = {}) {
        const response = await fetch(url, {
            method, credentials: "same-origin", cache: "no-store",
            headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `Ошибка HTTP ${response.status}`);
        return result;
    }
    async function save(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const url = initial ? `/api/admin/alerts/${encodeURIComponent(initial.id)}` : "/api/admin/alerts";
            const result = await send(url, initial ? "PATCH" : "POST", form,
                initial ? { "X-Expected-Updated-At": version } : {});
            setDirty(false);
            if (!initial) router.replace(`/admin/alerts/${result.id}`);
            else {
                setVersion(result.updatedAt);
                setMessage(status === "PUBLISHED" ? "Изменения опубликованы на сайте." : "Черновик сохранён.");
            }
            router.refresh();
        } catch (e) { setError(e.message || "Не удалось сохранить сообщение."); }
        finally { setBusy(false); }
    }
    async function changePublication(action) {
        if (!initial || busy || dirty || !version) return;
        if (!window.confirm(action === "publish" ?
            "Подтверждаете источник и достоверность информации? Опубликовать сообщение для жителей?" :
            "Снять сообщение с сайта и с главной страницы?")) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const result = await send(`/api/admin/alerts/${encodeURIComponent(initial.id)}/status`,
                "POST", { action, expectedUpdatedAt: version });
            setVersion(result.updatedAt); setStatus(result.status);
            setMessage(result.status === "PUBLISHED" ? "Сообщение опубликовано." : "Сообщение снято с публикации.");
            router.refresh();
        } catch (e) { setError(e.message || "Не удалось изменить статус."); }
        finally { setBusy(false); }
    }
    // The publication button is informative; the server checks this again against the database.
    const parsed = validateServiceAlert(form);
    const publicationReady = parsed && isServiceAlertPublicationReady(parsed);
    return <main className={styles.page}>
        <Link href="/admin/alerts" className={styles.back}>← К городским службам</Link>
        <header className={styles.heading}>
            <div>
                <p className={styles.kicker}>Поток 96 / Официально</p>
                <h2>{initial ? "Редактирование уведомления" : "Новое уведомление городских служб"}</h2>
                <p>Публикуйте только подтверждённые сведения. Время указывается по Красноуфимску (UTC+5).</p>
            </div>
            <span className={styles.pill}>{status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span>
        </header>
        {initial && status === "PUBLISHED" && <p className={styles.info}>
            <Link href="/alerts">Посмотреть на сайте</Link>
        </p>}
        <form className={styles.form} onSubmit={save}>
            <fieldset className={styles.fieldset} disabled={busy}>
                <label>Заголовок *
                    <input required maxLength={200} value={form.title} onChange={e => update("title", e.target.value)}
                        placeholder="Плановое отключение воды" /></label>
                <div className={styles.two}>
                    <label>Адрес записи (slug) *
                        <input required minLength={3} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                            disabled={status === "PUBLISHED"} value={form.slug}
                            onChange={e => update("slug", e.target.value)} placeholder="voda-2026-11-15" /></label>
                    <label>Коммунальная услуга *
                        <select className={local.select} value={form.service} onChange={e => update("service", e.target.value)}>
                            {Object.entries(serviceNames).map(([value, label]) =>
                                <option key={value} value={value}>{label}</option>)}
                        </select></label>
                </div>
                <div className={styles.two}>
                    <label>Состояние *
                        <select className={local.select} value={form.state} onChange={e => update("state", e.target.value)}>
                            {Object.entries(stateNames).map(([value, label]) =>
                                <option key={value} value={value}>{label}</option>)}
                        </select></label>
                    <label>Приоритет *
                        <select className={local.select} value={form.urgency} onChange={e => update("urgency", e.target.value)}>
                            <option value="normal">Обычный</option><option value="urgent">Срочно</option>
                        </select></label>
                </div>
                <div className={styles.two}>
                    <label>Начало (UTC+5) *
                        <input type="datetime-local" required value={form.startAt}
                            onChange={e => update("startAt", e.target.value)} /></label>
                    <label>Планируемое окончание (UTC+5)
                        <input type="datetime-local" value={form.expectedEndAt}
                            onChange={e => update("expectedEndAt", e.target.value)} /></label>
                </div>
                {form.state === "restored" &&
                    <label>Фактическое восстановление (UTC+5) *
                        <input type="datetime-local" required={status === "PUBLISHED"} value={form.restoredAt}
                            onChange={e => update("restoredAt", e.target.value)} /></label>}
                <label>Адреса и территория (до 1 000 символов)
                    <textarea rows={3} maxLength={1000} value={form.addresses}
                        onChange={e => update("addresses", e.target.value)} placeholder="Улица, номера домов, микрорайон" /></label>
                <label>Подтверждённый источник (название организации) *
                    <input maxLength={240} value={form.source} onChange={e => update("source", e.target.value)}
                        placeholder="Диспетчерская служба водоканала" /></label>
                <label>Ссылка на официальный источник (HTTPS)
                    <input type="url" maxLength={2048} value={form.sourceUrl}
                        onChange={e => update("sourceUrl", e.target.value)} placeholder="https://example.org/notice" /></label>
                <label>Подробности (Markdown, до 20 000 символов)
                    <textarea rows={8} maxLength={20000} value={form.content}
                        onChange={e => update("content", e.target.value)} /></label>
                <label className={local.confirmRow}>
                    <input type="checkbox" checked={form.confirmed}
                        onChange={e => update("confirmed", e.target.checked)} />
                    <span>Подтверждаю, что информация получена из проверенного источника и может быть опубликована</span>
                </label>
                <p className={styles.help}>Черновики не показываются посетителям. После публикации изменение состояния сразу обновляет страницу городских служб и главную.</p>
            </fieldset>
            <div className={styles.actions}>
                <button type="submit" className={styles.primary} disabled={busy}>
                    {busy ? "Сохраняем…" : "Сохранить"}</button>
                {initial && <button type="button" className={styles.secondary}
                    disabled={busy || dirty || (status === "DRAFT" && !publicationReady)}
                    onClick={() => changePublication(status === "PUBLISHED" ? "unpublish" : "publish")}>
                    {status === "PUBLISHED" ? "Снять с публикации" : "Опубликовать"}
                </button>}
                {dirty && <span className={styles.help}>Есть несохранённые изменения.</span>}
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {message && <p role="status" className={styles.success}>{message}</p>}
        </form>
    </main>;
}
