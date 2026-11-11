"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EVENT_CATEGORIES } from "@/lib/eventCategories";
import styles from "./events-admin.module.css";

const defaults = {
    title: "", slug: "", category: "other", startAt: "", endAt: "", location: "", price: "",
    isFree: false, pushkinCard: false, pushkinProofUrl: "", summary: "", cover: "",
    orgSlug: "", video: "", content: "",
};
const keys = Object.keys(defaults);
const fromInitial = initial => initial
    ? Object.fromEntries(keys.map(key => [key, initial[key] ?? defaults[key]])) : { ...defaults };

export default function EventForm({ initial }) {
    const router = useRouter();
    const [form, setForm] = useState(() => fromInitial(initial));
    const [status, setStatus] = useState(initial?.status ?? "DRAFT");
    const [version, setVersion] = useState(initial?.updatedAt ?? "");
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!dirty) return;
        const warn = event => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    function update(key, value) {
        setForm(old => {
            const next = { ...old, [key]: value };
            if (key === "isFree" && value) {
                next.price = "";
                next.pushkinCard = false;
                next.pushkinProofUrl = "";
            }
            if (key === "pushkinCard" && !value) next.pushkinProofUrl = "";
            return next;
        });
        setDirty(true); setMessage(""); setError("");
    }

    async function request(url, method, data, headers = {}) {
        const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
            headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(data) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
        return result;
    }
    async function save(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const result = await request(initial ? `/api/admin/events/${encodeURIComponent(initial.id)}` : "/api/admin/events",
                initial ? "PATCH" : "POST", form,
                initial ? { "X-Expected-Updated-At": version } : {});
            setDirty(false);
            if (!initial) {
                router.replace(`/admin/events/${result.id}`);
                router.refresh();
            } else {
                setVersion(result.updatedAt);
                setMessage(status === "PUBLISHED" ? "Изменения сохранены и отображаются на сайте." : "Черновик сохранён.");
                router.refresh();
            }
        } catch (err) { setError(err.message || "Не удалось сохранить мероприятие."); }
        finally { setBusy(false); }
    }
    async function publish(action) {
        if (!initial || busy || dirty || !version) return;
        if (!window.confirm(action === "publish" ? "Опубликовать мероприятие в афише?" :
            "Снять мероприятие с публикации? Оно исчезнет из афиши.")) return;
        setBusy(true); setMessage(""); setError("");
        try {
            const result = await request(`/api/admin/events/${encodeURIComponent(initial.id)}/status`,
                "POST", { action, expectedUpdatedAt: version });
            setVersion(result.updatedAt); setStatus(result.status);
            setMessage(result.status === "PUBLISHED" ? "Мероприятие опубликовано." : "Мероприятие снято с публикации.");
            router.refresh();
        } catch (err) { setError(err.message || "Не удалось изменить статус."); }
        finally { setBusy(false); }
    }
    return <main className={styles.page}>
        <Link className={styles.back} href="/admin/events">← К мероприятиям</Link>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Афиша</p>
                <h2>{initial ? "Редактирование мероприятия" : "Новое мероприятие"}</h2>
                <p>{status === "PUBLISHED" ? "Изменения в опубликованной карточке становятся видны сразу после сохранения." :
                    "Сначала сохраните черновик, затем опубликуйте. Дата и время вводятся по Красноуфимску (UTC+5)."}</p></div>
            <span className={styles.pill}>{status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span>
        </header>
        {initial && status === "PUBLISHED" && <p className={styles.info}>
            <Link href={`/events/${form.slug}`}>Открыть мероприятие на сайте</Link></p>}
        <form className={styles.form} onSubmit={save}>
            <fieldset className={styles.fieldset} disabled={busy}>
                <div className={styles.two}>
                    <label>Название *<input required maxLength={180} value={form.title}
                        onChange={e => update("title", e.target.value)} /></label>
                    <label>Адрес страницы (slug) *<input required minLength={3} maxLength={160}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug}
                        disabled={status === "PUBLISHED"}
                        onChange={e => update("slug", e.target.value)} placeholder="koncert-2027" /></label>
                </div>
                <div className={styles.two}>
                    <label>Категория *<select value={form.category} onChange={e => update("category", e.target.value)}>
                        {EVENT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
                    <label>Организатор — slug организации<input maxLength={160}
                        pattern="[a-z0-9]*(-[a-z0-9]+)*" value={form.orgSlug}
                        onChange={e => update("orgSlug", e.target.value)} placeholder="kosmos" /></label>
                </div>
                <div className={styles.two}>
                    <label>Начало (Красноуфимск, UTC+5) *<input required type="datetime-local"
                        value={form.startAt} onChange={e => update("startAt", e.target.value)} /></label>
                    <label>Окончание (необязательно)<input type="datetime-local" value={form.endAt}
                        onChange={e => update("endAt", e.target.value)} /></label>
                </div>
                <label>Место проведения<input maxLength={240} value={form.location}
                    onChange={e => update("location", e.target.value)} placeholder="ЦКиД, Красноуфимск" /></label>
                <div className={styles.two}>
                    <label className={styles.check}><input type="checkbox" checked={form.isFree}
                        onChange={e => update("isFree", e.target.checked)} /> Бесплатное мероприятие</label>
                    <label>Стоимость (если платно)<input maxLength={80} disabled={form.isFree}
                        value={form.price} onChange={e => update("price", e.target.value)} placeholder="от 300 ₽" /></label>
                </div>
                <div className={styles.proof}>
                    <label className={styles.check}><input type="checkbox" disabled={form.isFree} checked={form.pushkinCard}
                        onChange={e => update("pushkinCard", e.target.checked)} /> Доступно по Пушкинской карте</label>
                    {form.pushkinCard && <label>Ссылка на официальное подтверждение участия *
                        <input required type="url" maxLength={2048} value={form.pushkinProofUrl}
                            onChange={e => update("pushkinProofUrl", e.target.value)} placeholder="https://www.culture.ru/..." /></label>}
                    <p className={styles.help}>Помечайте «Пушкинская карта» только при подтверждённой возможности оплаты. Ссылка хранится в CMS и не показывается в афише.</p>
                </div>
                <label>Краткое описание<input maxLength={600} value={form.summary}
                    onChange={e => update("summary", e.target.value)} /></label>
                <label>Текст мероприятия (Markdown, до 30 000 символов)<textarea rows={12} maxLength={30000}
                    value={form.content} onChange={e => update("content", e.target.value)} /></label>
                <div className={styles.two}>
                    <label>Обложка — локальный путь<input maxLength={512} value={form.cover}
                        onChange={e => update("cover", e.target.value)} placeholder="/media/events/poster.webp" /></label>
                    <label>Видео — YouTube nocookie / Rutube embed<input type="url" maxLength={2048}
                        value={form.video} onChange={e => update("video", e.target.value)}
                        placeholder="https://rutube.ru/play/embed/..." /></label>
                </div>
                <p className={styles.help}>На этапе 5.7.1 загрузка обложек через интерфейс ещё не предусмотрена. Можно указать существующий файл из /media/events/ либо оставить поле пустым.</p>
            </fieldset>
            <div className={styles.actions}>
                <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
                {initial && <button type="button" className={styles.secondary} disabled={busy || dirty}
                    onClick={() => publish(status === "PUBLISHED" ? "unpublish" : "publish")}>
                    {status === "PUBLISHED" ? "Снять с публикации" : "Опубликовать"}</button>}
                {dirty && <span className={styles.help}>Есть несохранённые изменения — сохраните их перед публикацией.</span>}
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {message && <p role="status" className={styles.success}>{message}</p>}
        </form>
    </main>;
}
