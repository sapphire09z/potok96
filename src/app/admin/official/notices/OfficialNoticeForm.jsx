"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./official-notices.module.css";

const defaults = {
    slug: "", title: "", date: "", issuer: "", locality: "",
    summary: "", sourceUrl: "", content: "",
};
const fields = Object.keys(defaults);
function fromInitial(initial) {
    return initial ? Object.fromEntries(fields.map(field => [field, initial[field] ?? ""])) : { ...defaults };
}

export default function OfficialNoticeForm({ initial }) {
    const router = useRouter();
    const [form, setForm] = useState(() => fromInitial(initial));
    const [status, setStatus] = useState(initial?.status ?? "DRAFT");
    const [version, setVersion] = useState(initial?.updatedAt ?? "");
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    useEffect(() => {
        if (!dirty) return;
        const warn = e => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);
    function change(field, value) {
        setForm(old => ({ ...old, [field]: value }));
        setDirty(true); setError(""); setMessage("");
    }
    async function request(url, method, body, headers = {}) {
        const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
            headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
        return result;
    }
    async function save(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const result = await request(initial ? `/api/admin/official/notices/${encodeURIComponent(initial.id)}` :
                "/api/admin/official/notices", initial ? "PATCH" : "POST", form,
            initial ? { "X-Expected-Updated-At": version } : {});
            setDirty(false);
            if (!initial) {
                router.replace(`/admin/official/notices/${result.id}`);
                router.refresh();
            } else {
                setVersion(result.updatedAt);
                setMessage(status === "PUBLISHED" ? "Изменения сохранены и доступны посетителям." : "Черновик сохранён.");
                router.refresh();
            }
        } catch (e) { setError(e.message || "Не удалось сохранить сообщение."); }
        finally { setBusy(false); }
    }
    async function publication(action) {
        if (!initial || busy || dirty || !version) return;
        if (!window.confirm(action === "publish" ?
            "Публикуем проверенное сообщение от указанного ведомства?" :
            "Снять сообщение с публикации? Публичная страница станет недоступна.")) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const result = await request(`/api/admin/official/notices/${encodeURIComponent(initial.id)}/status`,
                "POST", { action, expectedUpdatedAt: version });
            setVersion(result.updatedAt); setStatus(result.status);
            setMessage(result.status === "PUBLISHED" ? "Сообщение опубликовано." : "Сообщение снято с публикации.");
            router.refresh();
        } catch (e) { setError(e.message || "Не удалось изменить статус."); }
        finally { setBusy(false); }
    }
    return <main className={styles.page}>
        <Link className={styles.back} href="/admin/official/notices">← К сообщениям</Link>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Официально</p>
                <h2>{initial ? "Редактирование сообщения" : "Новое официальное сообщение"}</h2>
                <p>Указывайте только проверенные сведения. Название ведомства должно соответствовать реальному источнику.</p></div>
            <span className={styles.pill}>{status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span>
        </header>
        {initial && status === "PUBLISHED" &&
            <p className={styles.info}><Link href={`/official/notices/${form.slug}`}>Открыть сообщение на сайте</Link></p>}
        <form className={styles.form} onSubmit={save}>
            <fieldset className={styles.fieldset} disabled={busy}>
                <label>Заголовок *<input required maxLength={200} value={form.title}
                    onChange={e => change("title", e.target.value)} /></label>
                <div className={styles.two}>
                    <label>Адрес страницы (slug) *<input required minLength={3} maxLength={160}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug}
                        disabled={status === "PUBLISHED"}
                        onChange={e => change("slug", e.target.value)} placeholder="notice-2026-11-12" /></label>
                    <label>Дата сообщения *<input type="date" required value={form.date}
                        onChange={e => change("date", e.target.value)} /></label>
                </div>
                <div className={styles.two}>
                    <label>Ведомство / учреждение *<input required maxLength={240} value={form.issuer}
                        onChange={e => change("issuer", e.target.value)} placeholder="Администрация городского округа Красноуфимск" /></label>
                    <label>Территория (необязательно)<input maxLength={200} value={form.locality}
                        onChange={e => change("locality", e.target.value)} placeholder="Красноуфимск" /></label>
                </div>
                <label>Краткое описание<input maxLength={600} value={form.summary}
                    onChange={e => change("summary", e.target.value)} /></label>
                <label>Ссылка на официальный источник (HTTPS)<input type="url" maxLength={2048}
                    value={form.sourceUrl} onChange={e => change("sourceUrl", e.target.value)}
                    placeholder="https://example.ru/notice" /></label>
                <label>Полный текст сообщения (Markdown, до 30 000 символов) *
                    <textarea required rows={13} maxLength={30000} value={form.content}
                        onChange={e => change("content", e.target.value)} /></label>
                <p className={styles.help}>Сообщение можно сохранить как черновик. Публикация — отдельное действие.
                    URL опубликованного сообщения не меняется, пока оно доступно на сайте.</p>
            </fieldset>
            <div className={styles.actions}>
                <button type="submit" className={styles.primary} disabled={busy}>
                    {busy ? "Сохраняем…" : "Сохранить"}</button>
                {initial && <button type="button" className={styles.secondary} disabled={busy || dirty}
                    onClick={() => publication(status === "PUBLISHED" ? "unpublish" : "publish")}>
                    {status === "PUBLISHED" ? "Снять с публикации" : "Опубликовать"}</button>}
                {dirty && <span className={styles.help}>Есть несохранённые изменения.</span>}
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {message && <p role="status" className={styles.success}>{message}</p>}
        </form>
    </main>;
}
