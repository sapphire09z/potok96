"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./draft-form.module.css";

const MAX_PHOTOS = 12;
const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function defaultMetadata(images) {
    return Object.fromEntries(images.map((image) => [image.id, {
        caption: image.caption ?? "", credit: image.credit ?? "", rightsNote: image.rightsNote ?? "",
    }]));
}

export default function NewsImageManager({ postId, images, coverImageId, onImages, onCover, onInsert, body }) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [metadata, setMetadata] = useState(() => defaultMetadata(images));

    if (!postId) {
        return <section className={styles.photoPanel}>
            <h2>Фотографии</h2>
            <p className={styles.hint}>Сначала сохраните новость как черновик. После этого здесь появится загрузка фотографий, выбор обложки и вставка изображений в статью.</p>
        </section>;
    }

    async function readResult(response) {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Ошибка сервера: ${response.status}`);
        return data;
    }

    async function upload(event) {
        const files = [...(event.target.files || [])];
        event.target.value = "";
        if (!files.length || busy) return;
        if (files.length + images.length > MAX_PHOTOS) {
            setError(`Допустимо не более ${MAX_PHOTOS} фотографий.`); return;
        }
        if (files.some((file) => !TYPES.has(file.type) || !file.size || file.size > MAX_SIZE)) {
            setError("Только JPEG, PNG или WebP не более 5 МБ на файл."); return;
        }
        setBusy(true); setError(""); setMessage("");
        try {
            for (const [index, file] of files.entries()) {
                setMessage(`Загружаем фото ${index + 1} из ${files.length}…`);
                const data = new FormData(); data.append("file", file);
                const response = await fetch(`/api/editor/news/${postId}/images`, {
                    method: "POST", body: data, credentials: "same-origin",
                });
                const result = await readResult(response);
                onImages((current) => [...current, result.image]);
                if (result.coverImageId) onCover(result.coverImageId);
                setMetadata((current) => ({ ...current, [result.image.id]: {
                    caption: "", credit: "", rightsNote: "",
                } }));
            }
            setMessage("Фотографии загружены в закрытое хранилище.");
        } catch (err) { setError(err.message || "Загрузка не удалась."); }
        finally { setBusy(false); }
    }

    async function changeCover(id) {
        setBusy(true); setMessage(""); setError("");
        try {
            await readResult(await fetch(`/api/editor/news/${postId}/images/${id}`, {
                method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cover" }),
            }));
            onCover(id);
            setMessage("Обложка выбрана.");
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    function editMeta(id, field, value) {
        setMetadata((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
        setMessage("");
    }

    async function saveMeta(id) {
        setBusy(true); setMessage(""); setError("");
        try {
            const data = metadata[id];
            const result = await readResult(await fetch(`/api/editor/news/${postId}/images/${id}`, {
                method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "metadata", ...data }),
            }));
            onImages((current) => current.map((item) => item.id === id ? { ...item, ...result.image } : item));
            setMessage("Сведения о фотографии сохранены.");
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    async function remove(id) {
        if (body.includes(`/api/editor/news/${postId}/images/${id}`)) {
            setError("Сначала удалите изображение из текста статьи и сохраните черновик.");
            return;
        }
        if (!confirm("Удалить фотографию из черновика?")) return;
        setBusy(true); setMessage(""); setError("");
        try {
            const result = await readResult(await fetch(`/api/editor/news/${postId}/images/${id}`, {
                method: "DELETE", credentials: "same-origin",
            }));
            onImages((current) => current.filter((item) => item.id !== id));
            onCover(result.coverImageId ?? null);
            setMessage("Фотография удалена.");
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    return <section className={styles.photoPanel} aria-label="Фотографии новости">
        <h2>Фотографии ({images.length}/{MAX_PHOTOS})</h2>
        <p className={styles.hint}>Файлы хранятся приватно до публикации. Для отправки на проверку у каждой фотографии нужны автор / правообладатель и основание использования. Заполните эти поля, нажмите «Сохранить подпись». Кнопка «В текст» вставляет фотографию в статью.</p>
        {images.length < MAX_PHOTOS && <label className={styles.photoAdd}>
            Добавить фотографии
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={upload}/>
        </label>}
        <div className={styles.photoGrid}>
            {images.map((item) => <div key={item.id} className={styles.photoItem}>
                <Image src={`/api/editor/news/${postId}/images/${item.id}?size=320`}
                    alt={item.caption || "Фотография новости"} width={320} height={200} unoptimized />
                <label>Подпись
                    <input value={metadata[item.id]?.caption ?? ""} maxLength={240}
                        onChange={(e) => editMeta(item.id, "caption", e.target.value)} />
                </label>
                <label>Автор / правообладатель (для отправки на проверку)
                    <input value={metadata[item.id]?.credit ?? ""} maxLength={240}
                        onChange={(e) => editMeta(item.id, "credit", e.target.value)} />
                </label>
                <label>Основание использования / лицензия (для отправки на проверку)
                    <input value={metadata[item.id]?.rightsNote ?? ""} maxLength={1000}
                        onChange={(e) => editMeta(item.id, "rightsNote", e.target.value)} />
                </label>
                <div className={styles.photoButtons}>
                    <button type="button" disabled={busy || item.id === coverImageId}
                        onClick={() => changeCover(item.id)}>{item.id === coverImageId ? "Обложка ✓" : "На обложку"}</button>
                    <button type="button" disabled={busy} onClick={() => saveMeta(item.id)}>Сохранить подпись</button>
                    <button type="button" disabled={busy} onClick={() => onInsert({ ...item, ...metadata[item.id] })}>В текст</button>
                    <button type="button" disabled={busy} onClick={() => remove(item.id)}>Удалить</button>
                </div>
            </div>)}
        </div>
        {message && <p className={styles.hint} role="status">{message}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
    </section>;
}
