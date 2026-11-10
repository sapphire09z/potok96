"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ORG_CATEGORIES } from "@/lib/orgCategories";
import OrganizationMediaManager from "./OrganizationMediaManager";
import OrganizationPlacementControls from "./OrganizationPlacementControls";
import styles from "./orgs-admin.module.css";

const defaults = {
    title: "", slug: "", type: "", category: "other", area: "city", locality: "Красноуфимск",
    address: "", phone: "", hours: "", tags: "", services: "", website: "", email: "", mapUrl: "",
    vkUrl: "", okUrl: "", maxUrl: "", logo: "", cover: "", content: "",
};
const keyFields = Object.keys(defaults);

function fromInitial(initial) {
    if (!initial) return defaults;
    const fields = Object.fromEntries(keyFields.map(key => [key,
        key === "tags" || key === "services"
            ? (initial[key] ?? []).join("\n") : (initial[key] ?? "")
    ]));
    return fields;
}

function payload(form) {
    return Object.fromEntries(keyFields.map(key => [key,
        key === "tags" || key === "services" ? form[key].split("\n").map(s => s.trim()).filter(Boolean) : form[key],
    ]));
}

export default function OrganizationForm({ initial }) {
    const router = useRouter();
    const [form, setForm] = useState(() => fromInitial(initial));
    const [status, setStatus] = useState(initial?.status ?? "DRAFT");
    const [version, setVersion] = useState(initial?.updatedAt ?? "");
    const [busy, setBusy] = useState(false);
    const [mediaBusy, setMediaBusy] = useState(false);
    const [placementBusy, setPlacementBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [dirty, setDirty] = useState(false);
    const published = status === "PUBLISHED";

    useEffect(() => {
        if (!dirty) return;
        const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    function update(key, value) {
        setForm(previous => ({ ...previous, [key]: value }));
        setDirty(true);
        setNotice("");
        setError("");
    }

    async function save(event) {
        event.preventDefault();
        if (busy || mediaBusy || placementBusy || published) return;
        setBusy(true); setError(""); setNotice("");
        try {
            const response = await fetch(initial ? `/api/admin/orgs/${encodeURIComponent(initial.id)}` : "/api/admin/orgs", {
                method: initial ? "PATCH" : "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json", ...(initial ? { "X-Expected-Updated-At": version } : {}) },
                body: JSON.stringify(payload(form)),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            setDirty(false);
            if (!initial) {
                router.replace(`/admin/orgs/${result.id}`);
                router.refresh();
            } else {
                setVersion(result.updatedAt);
                setNotice("Карточка сохранена.");
            }
        } catch (err) { setError(err.message || "Не удалось сохранить данные."); }
        finally { setBusy(false); }
    }

    async function setPublication(action) {
        if (!initial || busy || mediaBusy || placementBusy || dirty || !version) return;
        if (!window.confirm(action === "publish" ? "Опубликовать карточку в городском справочнике?" :
            "Снять карточку с публикации? Она временно исчезнет с сайта.")) return;
        setBusy(true); setError(""); setNotice("");
        try {
            const response = await fetch(`/api/admin/orgs/${encodeURIComponent(initial.id)}/status`, {
                method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, expectedUpdatedAt: version }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            setVersion(result.updatedAt);
            setStatus(result.status);
            setNotice(result.status === "PUBLISHED" ? "Карточка опубликована." : "Карточка снята с публикации.");
            router.refresh();
        } catch (err) { setError(err.message || "Не удалось изменить публикацию."); }
        finally { setBusy(false); }
    }

    return <main className={styles.page}>
        <Link href="/admin/orgs" className={styles.back}>← К организациям</Link>
        <header className={styles.heading}>
            <div><p className={styles.kicker}>Поток 96 / Справочник</p>
                <h2>{initial ? "Редактирование организации" : "Новая организация"}</h2>
                <p>{published ? "Опубликованная карточка доступна только для просмотра. Снимите её с публикации, чтобы изменить." :
                    "Сначала сохраните черновик. На сайте он появится только после публикации."}</p></div>
            <span className={styles.pill}>{published ? "Опубликовано" : "Черновик"}</span>
        </header>
        {published && initial && <p className={styles.info}><Link href={`/orgs/${initial.slug}`}>Открыть карточку на сайте</Link></p>}
        <form onSubmit={save} className={styles.form}>
            <fieldset disabled={busy || mediaBusy || placementBusy || published} className={styles.fieldset}>
                <div className={styles.two}>
                    <label>Название организации *<input required maxLength={160} value={form.title} onChange={e => update("title", e.target.value)} /></label>
                    <label>Slug (латиница, через дефис) *<input required maxLength={160} minLength={3} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={e => update("slug", e.target.value)} placeholder="primer-organizatsii" /></label>
                </div>
                <div className={styles.two}>
                    <label>Категория *<select required value={form.category} onChange={e => update("category", e.target.value)}>
                        {ORG_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select></label>
                    <label>Тип / направление<input maxLength={120} value={form.type} onChange={e => update("type", e.target.value)} placeholder="Культурный центр" /></label>
                </div>
                <div className={styles.two}>
                    <label>Территория<select value={form.area} onChange={e => update("area", e.target.value)}>
                        <option value="city">Красноуфимск</option><option value="district">Красноуфимский район</option>
                    </select></label>
                    <label>Населённый пункт<input maxLength={120} value={form.locality} onChange={e => update("locality", e.target.value)} /></label>
                </div>
                <div className={styles.two}>
                    <label>Адрес<input maxLength={240} value={form.address} onChange={e => update("address", e.target.value)} /></label>
                    <label>Телефон<input maxLength={100} value={form.phone} onChange={e => update("phone", e.target.value)} /></label>
                </div>
                <label>Режим работы<textarea rows={2} maxLength={600} value={form.hours} onChange={e => update("hours", e.target.value)} /></label>
                <div className={styles.two}>
                    <label>Теги (по одному на строку, до 16)<textarea rows={4} value={form.tags} onChange={e => update("tags", e.target.value)} /></label>
                    <label>Услуги (по одной на строку, до 24)<textarea rows={4} value={form.services} onChange={e => update("services", e.target.value)} /></label>
                </div>
                <label>Описание (Markdown, до 12 000 символов)<textarea rows={10} maxLength={12000} value={form.content} onChange={e => update("content", e.target.value)} /></label>
                <div className={styles.two}>
                    <label>Сайт (HTTPS)<input type="url" maxLength={2048} value={form.website} onChange={e => update("website", e.target.value)} /></label>
                    <label>E-mail<input type="email" maxLength={254} value={form.email} onChange={e => update("email", e.target.value)} /></label>
                </div>
                <label>Ссылка на карту (HTTPS)<input type="url" maxLength={2048} value={form.mapUrl} onChange={e => update("mapUrl", e.target.value)} /></label>
                <div className={styles.two}>
                    <label>ВКонтакте (HTTPS)<input type="url" maxLength={2048} value={form.vkUrl} onChange={e => update("vkUrl", e.target.value)} /></label>
                    <label>Одноклассники (HTTPS)<input type="url" maxLength={2048} value={form.okUrl} onChange={e => update("okUrl", e.target.value)} /></label>
                </div>
                <label>MAX (HTTPS)<input type="url" maxLength={2048} value={form.maxUrl} onChange={e => update("maxUrl", e.target.value)} /></label>
                <div className={styles.two}>
                    <label>Логотип (путь /media/orgs/…)<input maxLength={512} value={form.logo} onChange={e => update("logo", e.target.value)} placeholder="/media/orgs/logo.webp" /></label>
                    <label>Обложка (путь /media/orgs/…)<input maxLength={512} value={form.cover} onChange={e => update("cover", e.target.value)} placeholder="/media/orgs/cover.webp" /></label>
                </div>
                <p className={styles.help}>Пути из /media/orgs/ используются как резервный вариант, если не выбран загруженный логотип или обложка.</p>
            </fieldset>
            {initial ? <OrganizationMediaManager
                orgId={initial.id} images={initial.images ?? []}
                logoImageId={initial.logoImageId} coverImageId={initial.coverImageId}
                disabled={busy || placementBusy || dirty || published} onBusy={setMediaBusy}
                onUpdated={() => router.refresh()} /> :
                <p className={styles.help}>Для загрузки фотографий сначала сохраните карточку организации.</p>}
            {initial && <OrganizationPlacementControls
                orgId={initial.id} initialPlacement={initial.placement}
                initialExtendedUntil={initial.extendedUntil} version={version}
                disabled={busy || mediaBusy || dirty} onBusy={setPlacementBusy}
                onVersion={setVersion} onUpdated={() => router.refresh()} />}
            <div className={styles.actions}>
                {!published && <button type="submit" className={styles.primary} disabled={busy || mediaBusy || placementBusy}>{busy ? "Сохраняем…" : "Сохранить черновик"}</button>}
                {initial && <button type="button" disabled={busy || mediaBusy || placementBusy || dirty} className={styles.secondary}
                    onClick={() => setPublication(published ? "unpublish" : "publish")}>{published ? "Снять с публикации" : "Опубликовать"}</button>}
                {dirty && <span className={styles.help}>Есть несохранённые изменения. Сначала сохраните.</span>}
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            {notice && <p role="status" className={styles.success}>{notice}</p>}
        </form>
    </main>;
}
