"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../notices/official-notices.module.css";

const defaults = { slug: "", title: "", type: "", number: "", date: "", issuer: "", description: "", sourceUrl: "" };
const fields = Object.keys(defaults);
function fromInitial(initial) {
    return initial ? Object.fromEntries(fields.map(field => [field, initial[field] ?? ""])) : { ...defaults };
}
export default function OfficialDocumentForm({ initial }) {
    const router = useRouter();
    const picker = useRef(null);
    const [form, setForm] = useState(() => fromInitial(initial));
    const [status, setStatus] = useState(initial?.status ?? "DRAFT");
    const [version, setVersion] = useState(initial?.updatedAt ?? "");
    const [hasPdf, setHasPdf] = useState(initial?.hasPdf ?? false);
    const [pdfUrl, setPdfUrl] = useState(initial?.publicPdfUrl ?? null);
    const [file, setFile] = useState(null);
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
    async function request(url, method, body, headers = {}, multipart = false) {
        const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
            headers: { ...(multipart ? {} : { "Content-Type": "application/json" }), ...headers },
            body: multipart ? body : JSON.stringify(body) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
        return result;
    }
    async function save(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const result = await request(initial ? `/api/admin/official/documents/${encodeURIComponent(initial.id)}` :
                "/api/admin/official/documents", initial ? "PATCH" : "POST", form,
            initial ? { "X-Expected-Updated-At": version } : {});
            setDirty(false);
            if (!initial) {
                router.replace(`/admin/official/documents/${result.id}`);
                router.refresh();
            } else {
                setVersion(result.updatedAt);
                setMessage(status === "PUBLISHED" ? "Изменения сохранены и доступны посетителям." : "Черновик сохранён.");
                router.refresh();
            }
        } catch (e) { setError(e.message || "Не удалось сохранить документ."); }
        finally { setBusy(false); }
    }
    async function uploadPdf() {
        if (!initial || busy || dirty || !file || status !== "DRAFT") return;
        setBusy(true); setError(""); setMessage("");
        try {
            const payload = new FormData(); payload.set("file", file);
            const result = await request(`/api/admin/official/documents/${encodeURIComponent(initial.id)}/pdf`,
                "POST", payload, { "X-Expected-Updated-At": version }, true);
            setHasPdf(result.hasPdf); setVersion(result.updatedAt);
            setFile(null); if (picker.current) picker.current.value = "";
            setMessage("PDF загружен в приватное хранилище. Теперь документ можно опубликовать.");
            router.refresh();
        } catch (e) { setError(e.message || "Не удалось загрузить PDF."); }
        finally { setBusy(false); }
    }
    async function publication(action) {
        if (!initial || busy || dirty || !version) return;
        if (!window.confirm(action === "publish" ?
            "Опубликовать проверенный документ и выдать постоянный CDN-адрес PDF?" :
            "Снять документ с сайта? Ранее полученная ссылка на PDF в кеше CDN может остаться доступной.")) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const result = await request(`/api/admin/official/documents/${encodeURIComponent(initial.id)}/status`,
                "POST", { action, expectedUpdatedAt: version });
            setVersion(result.updatedAt); setStatus(result.status);
            setPdfUrl(result.publicPdfUrl);
            setMessage(result.status === "PUBLISHED" ? "Документ опубликован." :
                "Документ снят с сайта. CDN-кеш прежнего PDF не отзывается автоматически.");
            router.refresh();
        } catch (e) { setError(e.message || "Не удалось изменить публикацию."); }
        finally { setBusy(false); }
    }
    return <main className={styles.page}>
        <Link className={styles.back} href="/admin/official/documents">← К нормативным документам</Link>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Официально</p>
                <h2>{initial ? "Редактирование НПА" : "Новый нормативный документ"}</h2>
                <p>Реквизиты и PDF должны соответствовать официальному документу. Публикация выполняется отдельно.</p></div>
            <span className={styles.pill}>{status === "PUBLISHED" ? "Опубликовано" : "Черновик"}</span>
        </header>
        {pdfUrl && status === "PUBLISHED" && <p className={styles.info}>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">Скачать опубликованный PDF</a>
            {" · "}<Link href="/official/documents">Открыть реестр</Link></p>}
        <form className={styles.form} onSubmit={save}>
            <fieldset className={styles.fieldset} disabled={busy}>
                <label>Название документа *<input required maxLength={300} value={form.title}
                    onChange={e => change("title", e.target.value)} /></label>
                <div className={styles.two}>
                    <label>Адрес (slug) *<input required minLength={3} maxLength={160}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} disabled={status === "PUBLISHED"}
                        onChange={e => change("slug", e.target.value)} placeholder="postanovlenie-123" /></label>
                    <label>Дата принятия *<input type="date" required value={form.date}
                        onChange={e => change("date", e.target.value)} /></label>
                </div>
                <div className={styles.two}>
                    <label>Вид документа *<input required maxLength={100} value={form.type}
                        onChange={e => change("type", e.target.value)} placeholder="Постановление" /></label>
                    <label>Номер<input maxLength={100} value={form.number}
                        onChange={e => change("number", e.target.value)} placeholder="123" /></label>
                </div>
                <label>Орган, принявший документ *<input required maxLength={240} value={form.issuer}
                    onChange={e => change("issuer", e.target.value)} /></label>
                <label>Описание (до 10 000 символов)<textarea rows={6} maxLength={10000} value={form.description}
                    onChange={e => change("description", e.target.value)} /></label>
                <label>Ссылка на официальный источник (HTTPS)<input type="url" maxLength={2048} value={form.sourceUrl}
                    placeholder="https://example.ru/document" onChange={e => change("sourceUrl", e.target.value)} /></label>
                <p className={styles.help}>Сначала сохраните карточку. Затем загрузите PDF (до 15 МБ). После публикации PDF нельзя заменить без снятия документа с публикации.</p>
            </fieldset>
            <div className={styles.actions}>
                <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Сохраняем…" : "Сохранить карточку"}</button>
                {initial && <button type="button" className={styles.secondary}
                    disabled={busy || dirty || (status === "DRAFT" && !hasPdf)}
                    onClick={() => publication(status === "PUBLISHED" ? "unpublish" : "publish")}>
                    {status === "PUBLISHED" ? "Снять с публикации" : "Опубликовать"}</button>}
                {dirty && <span className={styles.help}>Есть несохранённые изменения.</span>}
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {message && <p role="status" className={styles.success}>{message}</p>}
        </form>
        {initial && status === "DRAFT" && <section className={styles.form}>
            <h3>PDF документа</h3>
            <p className={styles.help}>{hasPdf ? "PDF загружен. Можно заменить, выбрав другой файл." : "PDF ещё не загружен."}</p>
            <div className={styles.actions}>
                <input ref={picker} type="file" accept=".pdf,application/pdf" disabled={busy}
                    onChange={e => setFile(e.target.files?.[0] ?? null)} />
                <button type="button" className={styles.secondary} disabled={busy || dirty || !file}
                    onClick={uploadPdf}>Загрузить PDF</button>
            </div>
            {dirty && <p className={styles.help}>Перед загрузкой сохраните изменения реквизитов.</p>}
        </section>}
    </main>;
}
