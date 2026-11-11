"use client";

import Image from "next/image";
import { useState } from "react";
import { EVENT_IMAGE_LIMIT } from "@/lib/eventMediaPolicy.mjs";
import styles from "./event-media.module.css";

const MAX_FILE = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function EventMediaManager({ eventId, version, images, coverImageId, disabled, onBusy, onUpdated }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [metadata, setMetadata] = useState(() => Object.fromEntries(images.map(photo => [photo.id, {
        caption: photo.caption ?? "", credit: photo.credit ?? "", rightsNote: photo.rightsNote ?? "",
    }])));
    const locked = busy || disabled;

    async function parsed(promise) {
        const response = await promise;
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
        return result;
    }
    async function action(callback) {
        if (locked) return;
        setBusy(true); onBusy(true); setError(""); setNotice("");
        try {
            const result = await callback();
            setNotice(result?.storageCleanupPending
                ? "Запись удалена; проверьте завершение очистки частного S3."
                : "Изменения сохранены.");
            onUpdated();
        } catch (cause) {
            setError(cause.message || "Ошибка работы с изображением.");
        } finally {
            setBusy(false); onBusy(false);
        }
    }
    async function upload(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || locked) return;
        if (images.length >= EVENT_IMAGE_LIMIT) {
            setError(`Можно загрузить не более ${EVENT_IMAGE_LIMIT} афиш.`); return;
        }
        if (!TYPES.has(file.type) || !file.size || file.size > MAX_FILE) {
            setError("Только JPEG, PNG или WebP до 5 МБ."); return;
        }
        await action(() => {
            const form = new FormData();
            form.append("file", file);
            return parsed(fetch(`/api/admin/events/${eventId}/images`, {
                method: "POST", credentials: "same-origin",
                headers: { "X-Expected-Updated-At": version }, body: form,
            }));
        });
    }
    async function patch(imageId, data) {
        await action(() => parsed(fetch(`/api/admin/events/${eventId}/images/${imageId}`, {
            method: "PATCH", credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-Expected-Updated-At": version },
            body: JSON.stringify(data),
        })));
    }
    async function remove(imageId) {
        if (locked || !window.confirm("Удалить эту афишу? Если она выбрана обложкой, обложка исчезнет с сайта.")) return;
        await action(() => parsed(fetch(`/api/admin/events/${eventId}/images/${imageId}`, {
            method: "DELETE", credentials: "same-origin",
            headers: { "X-Expected-Updated-At": version },
        })));
    }
    function editMetadata(imageId, field, value) {
        setMetadata(old => ({ ...old, [imageId]: { ...old[imageId], [field]: value } }));
        setNotice("");
    }
    return <section className={styles.panel} aria-label="Изображения мероприятия">
        <div className={styles.header}>
            <div><h3>Обложка мероприятия</h3>
                <p>Загрузите афиши в Selectel S3, заполните автора и основание использования,
                    затем назначьте основную обложку. Публичное изображение появляется только после публикации
                    мероприятия или выбора обложки у уже опубликованного события.</p></div>
            <span>{images.length}/{EVENT_IMAGE_LIMIT}</span>
        </div>
        {images.length < EVENT_IMAGE_LIMIT && <label className={styles.upload}>
            Добавить JPEG / PNG / WebP (до 5 МБ)
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={upload} />
        </label>}
        {disabled && <p className={styles.help}>Сначала сохраните изменения в полях мероприятия, чтобы работать с обложкой.</p>}
        <div className={styles.grid}>
            {images.map(photo => {
                const data = metadata[photo.id] ?? { caption: "", credit: "", rightsNote: "" };
                const canSelect = Boolean(photo.credit?.trim() && photo.rightsNote?.trim());
                const selected = photo.id === coverImageId;
                return <article key={photo.id} className={styles.card}>
                    <Image src={`/api/admin/events/${eventId}/images/${photo.id}?size=320`}
                        alt={photo.caption || "Предпросмотр афиши"} width={320} height={200} unoptimized
                        className={styles.preview} />
                    <span className={styles.tag}>{selected ? "Основная обложка" : "Загруженная афиша"}</span>
                    <label>Подпись<input disabled={locked} maxLength={240} value={data.caption}
                        onChange={event => editMetadata(photo.id, "caption", event.target.value)} /></label>
                    <label>Автор / правообладатель<input disabled={locked} maxLength={240} value={data.credit}
                        onChange={event => editMetadata(photo.id, "credit", event.target.value)} /></label>
                    <label>Основание использования<textarea disabled={locked} rows={2} maxLength={1000}
                        value={data.rightsNote} onChange={event => editMetadata(photo.id, "rightsNote", event.target.value)} /></label>
                    <div className={styles.buttons}>
                        <button type="button" disabled={locked} onClick={() => patch(photo.id, { action: "metadata", ...data })}>
                            Сохранить сведения</button>
                        <button type="button" disabled={locked || (!selected && !canSelect)}
                            title={!canSelect ? "Сначала сохраните сведения об авторе и правах" : undefined}
                            onClick={() => patch(photo.id, { action: selected ? "clearCover" : "cover" })}>
                            {selected ? "Убрать обложку" : "Сделать обложкой"}</button>
                        <button type="button" disabled={locked} onClick={() => remove(photo.id)}>Удалить</button>
                    </div>
                </article>;
            })}
        </div>
        {!images.length && <p className={styles.help}>Изображений пока нет. Можно опубликовать событие без обложки.</p>}
        <p className={styles.help}>Новая обложка имеет приоритет над полем «Локальный путь обложки».
            После снятия новой обложки старый локальный путь снова используется, если заполнен.
            Для защиты от одновременных изменений другие вкладки должны обновить страницу.</p>
        {busy && <p role="status" className={styles.help}>Обрабатываем изображение…</p>}
        {notice && <p role="status" className={styles.success}>{notice}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>;
}
