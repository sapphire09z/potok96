"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ORG_CATEGORIES } from "@/lib/orgCategories";
import styles from "./proposal.module.css";

const listFields = new Set(["tags", "services"]);
const multiline = new Set(["hours", "content"]);
const editable = ["title", "type", "category", "area", "locality", "address", "phone", "hours",
    "tags", "services", "website", "email", "mapUrl", "vkUrl", "okUrl", "maxUrl", "content"];

function toForm(value) {
    return Object.fromEntries(editable.map(key => [key, listFields.has(key) ? (value[key] || []).join("\n") : value[key] ?? ""]));
}
function toFields(value) {
    return Object.fromEntries(editable.map(key => [key, listFields.has(key)
        ? value[key].split("\n").map(x => x.trim()).filter(Boolean) : value[key]]));
}

export default function OrgProposalEditor({ orgId, original, proposal }) {
    const router = useRouter();
    const [form, setForm] = useState(() => toForm(proposal?.fields ?? original));
    const [version, setVersion] = useState(proposal?.updatedAt ?? null);
    const [status, setStatus] = useState(proposal?.status ?? null);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const submitted = status === "SUBMITTED";
    const returned = status === "RETURNED";

    useEffect(() => {
        if (!dirty) return;
        const warn = event => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    function change(key, value) {
        setForm(prev => ({ ...prev, [key]: value }));
        setDirty(true); setError(""); setMessage("");
    }
    async function send(method, suffix = "", body) {
        const response = await fetch(`/api/account/orgs/${encodeURIComponent(orgId)}/proposal${suffix}`, {
            method, credentials: "same-origin", cache: "no-store",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
        return result;
    }
    async function save(event) {
        event.preventDefault();
        if (busy || submitted) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const saved = await send("PUT", "", { fields: toFields(form), expectedProposalUpdatedAt: version });
            setVersion(saved.updatedAt); setStatus("DRAFT"); setDirty(false);
            setMessage("Черновик сохранён. Публичная страница не изменилась.");
        } catch (e) { setError(e.message || "Не удалось сохранить черновик."); }
        finally { setBusy(false); }
    }
    async function submit() {
        if (busy || dirty || status !== "DRAFT" || !version) return;
        if (!window.confirm("Отправить предложение на проверку редакции? После отправки редактирование будет недоступно до решения редакции.")) return;
        setBusy(true); setError(""); setMessage("");
        try {
            await send("POST", "/submit", { expectedProposalUpdatedAt: version });
            setStatus("SUBMITTED"); setMessage("Изменения отправлены на рассмотрение. Публичная карточка не изменилась.");
            router.refresh();
        } catch (e) { setError(e.message || "Не удалось отправить предложение."); }
        finally { setBusy(false); }
    }
    async function cancel() {
        if (busy || !["DRAFT", "RETURNED"].includes(status) || !version) return;
        if (!window.confirm("Удалить текущий черновик и вернуться к данным опубликованной карточки?")) return;
        setBusy(true); setError(""); setMessage("");
        try {
            await send("DELETE", "", { expectedProposalUpdatedAt: version });
            setVersion(null); setStatus(null); setDirty(false); setForm(toForm(original));
            setMessage("Черновик удалён."); router.refresh();
        } catch (e) { setError(e.message || "Не удалось удалить черновик."); }
        finally { setBusy(false); }
    }
    function entry(key, label, max, opts = {}) {
        const common = { value: form[key], disabled: busy || submitted,
            onChange: event => change(key, event.target.value), maxLength: max };
        return <label key={key}>{label}
            {opts.select ? <select {...common}>
                {opts.select.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select> : opts.rows || multiline.has(key)
                ? <textarea {...common} rows={opts.rows ?? 3} />
                : <input {...common} type={opts.type ?? "text"} required={Boolean(opts.required)} />}
        </label>;
    }
    return <section className={styles.panel}>
        <div className={styles.status} role="status">{submitted
            ? "На рассмотрении — редактирование заблокировано"
            : returned ? "Возвращено на доработку" : status === "DRAFT" ? "Сохранённый черновик" : "Новый черновик"}</div>
        {submitted && <p>Предложение ожидает решения редакции. Публичная карточка не изменяется.</p>}
        {returned && <p role="status">Комментарий редакции: {proposal?.reviewNote || "Требуется уточнение данных."} Исправьте поля, сохраните черновик и отправьте его повторно. Если карточка на сайте изменилась, удалите старый черновик и создайте новый.</p>}
        <form onSubmit={save} className={styles.form}>
            <div className={styles.two}>
                {entry("title", "Название *", 160, { required: true })}
                {entry("type", "Тип / направление", 120)}
                {entry("category", "Категория", 32, { select: ORG_CATEGORIES.map(item => ({ value: item.id, label: item.title })) })}
                {entry("area", "Территория", 12, { select: [
                    { value: "city", label: "Красноуфимск" },
                    { value: "district", label: "Красноуфимский район" },
                ] })}
                {entry("locality", "Населённый пункт", 120)}
                {entry("address", "Адрес", 240)}
                {entry("phone", "Телефон", 100)}
            </div>
            {entry("hours", "Режим работы", 600, { rows: 3 })}
            <div className={styles.two}>
                {entry("tags", "Теги — по одному на строку (до 16)", 2000, { rows: 4 })}
                {entry("services", "Услуги — по одной на строку (до 24)", 4000, { rows: 5 })}
                {entry("website", "Сайт (HTTPS)", 2048, { type: "url" })}
                {entry("email", "E-mail", 254, { type: "email" })}
                {entry("mapUrl", "Ссылка на карту (HTTPS)", 2048, { type: "url" })}
                {entry("vkUrl", "ВКонтакте (HTTPS)", 2048, { type: "url" })}
                {entry("okUrl", "Одноклассники (HTTPS)", 2048, { type: "url" })}
                {entry("maxUrl", "MAX (HTTPS)", 2048, { type: "url" })}
            </div>
            {entry("content", "Описание (Markdown, до 12 000 символов)", 12000, { rows: 10 })}
            <p className={styles.help}>Изменение адреса страницы (slug), платного размещения, фотографий и статуса публикации представителю недоступно.</p>
            <div className={styles.actions}>
                <button type="submit" disabled={busy || submitted}>{busy ? "Сохраняем…" : "Сохранить черновик"}</button>
                <button type="button" className={styles.secondary} disabled={busy || submitted || returned || dirty || !version}
                    onClick={submit}>Отправить на проверку</button>
                <button type="button" className={styles.secondary} disabled={busy || submitted || !version}
                    onClick={cancel}>Удалить черновик</button>
            </div>
            {dirty && <p className={styles.help}>Есть несохранённые изменения. Сохраните черновик перед отправкой.</p>}
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {message && <p role="status" className={styles.success}>{message}</p>}
        </form>
    </section>;
}
