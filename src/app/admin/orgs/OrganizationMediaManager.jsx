"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./orgs-admin.module.css";

const LIMIT = 12;
const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function OrganizationMediaManager({ orgId, images, logoImageId, coverImageId, disabled, onBusy, onUpdated }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [metadata, setMetadata] = useState(() => Object.fromEntries(images.map(image => [image.id, {
        caption: image.caption ?? "", credit: image.credit ?? "", rightsNote: image.rightsNote ?? "",
    }])));
    const locked = busy || disabled;

    async function json(response) {
        const resolved = await response;
        const body = await resolved.json().catch(() => ({}));
        if (!resolved.ok) throw new Error(body.error || `Ошибка ${resolved.status}`);
        return body;
    }

    async function action(work) {
        if (locked) return;
        setBusy(true); onBusy(true); setError(""); setMessage("");
        try {
            const result = await work();
            setMessage(result?.storageCleanupPending ? "Запись удалена. Очистка S3 требует проверки." : "Изменения сохранены.");
            onUpdated();
        } catch (err) {
            setError(err.message || "Не удалось обновить изображения.");
        } finally {
            setBusy(false); onBusy(false);
        }
    }

    async function upload(event) {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (!files.length || locked) return;
        if (files.length + images.length > LIMIT) {
            setError(`Не более ${LIMIT} фотографий на организацию.`); return;
        }
        if (files.some(file => !TYPES.has(file.type) || !file.size || file.size > MAX_SIZE)) {
            setError("Разрешены JPEG, PNG и WebP до 5 МБ каждый."); return;
        }
        await action(async () => {
            let uploaded = 0;
            try {
                for (const file of files) {
                    const body = new FormData(); body.append("file", file);
                    await json(fetch(`/api/admin/orgs/${orgId}/images`, {
                        method: "POST", credentials: "same-origin", body,
                    }));
                    uploaded++;
                }
                return {};
            } catch (error) {
                // A partially uploaded batch must still update the card list/version.
                if (uploaded) onUpdated();
                throw error;
            }
        });
    }

    function editMeta(imageId, field, value) {
        setMetadata(previous => ({ ...previous, [imageId]: { ...previous[imageId], [field]: value } }));
        setMessage("");
    }

    async function patch(imageId, body) {
        return action(() => json(fetch(`/api/admin/orgs/${orgId}/images/${imageId}`, {
            method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })));
    }

    async function remove(imageId) {
        if (locked || !window.confirm("Удалить фотографию из карточки?")) return;
        await action(() => json(fetch(`/api/admin/orgs/${orgId}/images/${imageId}`, {
            method: "DELETE", credentials: "same-origin",
        })));
    }

    return <section className={styles.mediaPanel} aria-label="Фотографии организации">
        <h3>Фотографии и оформление ({images.length}/{LIMIT})</h3>
        <p className={styles.help}>Сначала сохраните карточку. Загруженные фотографии остаются закрытыми до публикации.
            Для публикации у каждой фотографии заполните автора/правообладателя и основание использования.
            Один снимок можно назначить логотипом или обложкой, остальные появятся в галерее.</p>
        {!disabled && images.length < LIMIT && <label className={styles.mediaUpload}>
            Добавить фотографии (JPEG, PNG, WebP до 5 МБ)
            <input type="file" multiple accept="image/jpeg,image/png,image/webp"
                disabled={locked} onChange={upload} />
        </label>}
        {disabled && <p className={styles.help}>Для изменения фотографий снимите карточку с публикации и сохраните несохранённые поля.</p>}
        <div className={styles.mediaGrid}>
            {images.map(image => <div key={image.id} className={styles.mediaCard}>
                <Image src={`/api/admin/orgs/${orgId}/images/${image.id}?size=320`}
                    width={320} height={200} unoptimized alt={image.caption || "Фотография организации"} />
                <div className={styles.mediaFlags}>
                    {image.id === logoImageId && <span>Логотип</span>}
                    {image.id === coverImageId && <span>Обложка</span>}
                    {image.id !== logoImageId && image.id !== coverImageId && <span>Галерея</span>}
                </div>
                <label>Подпись
                    <input value={metadata[image.id]?.caption ?? ""} maxLength={240} disabled={locked}
                        onChange={e => editMeta(image.id, "caption", e.target.value)} />
                </label>
                <label>Автор / правообладатель
                    <input value={metadata[image.id]?.credit ?? ""} maxLength={240} disabled={locked}
                        onChange={e => editMeta(image.id, "credit", e.target.value)} />
                </label>
                <label>Основание использования
                    <textarea rows={2} value={metadata[image.id]?.rightsNote ?? ""} maxLength={1000} disabled={locked}
                        onChange={e => editMeta(image.id, "rightsNote", e.target.value)} />
                </label>
                <div className={styles.mediaButtons}>
                    <button type="button" disabled={locked} onClick={() => patch(image.id, { action: "metadata", ...metadata[image.id] })}>Сохранить сведения</button>
                    <button type="button" disabled={locked} onClick={() => patch(image.id, { action: image.id === logoImageId ? "clearLogo" : "logo" })}>
                        {image.id === logoImageId ? "Убрать логотип" : "Сделать логотипом"}</button>
                    <button type="button" disabled={locked} onClick={() => patch(image.id, { action: image.id === coverImageId ? "clearCover" : "cover" })}>
                        {image.id === coverImageId ? "Убрать обложку" : "Сделать обложкой"}</button>
                    <button type="button" disabled={locked} onClick={() => remove(image.id)}>Удалить</button>
                </div>
            </div>)}
        </div>
        {busy && <p role="status" className={styles.help}>Обрабатываем фотографии…</p>}
        {message && <p role="status" className={styles.help}>{message}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>;
}
