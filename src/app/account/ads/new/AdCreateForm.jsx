
"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AD_CATEGORIES } from "@/lib/adCategories.js";
import styles from "../ads.module.css";


export default function AdCreateForm({ initialAd = null }) {
    const router = useRouter();

    const [form, setForm] = useState({
        title: initialAd?.title ?? "",
        category: initialAd?.category ?? "",
        description: initialAd?.description ?? "",
        price:
            initialAd?.priceRub == null
                ? ""
                : String(initialAd.priceRub),
        location: initialAd?.location ?? "Красноуфимск",
    });


    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [queuedPhotos, setQueuedPhotos] = useState([]);
    const [progress, setProgress] = useState("");
    const [recoveryAdId, setRecoveryAdId] = useState(null);
    const previewsRef = useRef(new Set());

    useEffect(() => {
        const previews = previewsRef.current;
        return () => {
            for (const url of previews) URL.revokeObjectURL(url);
            previews.clear();
        };
    }, []);

    function addQueuedPhotos(event) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (busy || recoveryAdId || files.length === 0) return;

        if (queuedPhotos.length + files.length > 8) {
            setError("Не более 8 фотографий на объявление.");
            return;
        }
        const invalid = files.find((file) =>
            !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
            file.size === 0 || file.size > 5 * 1024 * 1024
        );
        if (invalid) {
            setError("Поддерживаются JPEG, PNG и WebP размером до 5 МБ каждая.");
            return;
        }

        setError("");
        const next = files.map((file) => {
            const preview = URL.createObjectURL(file);
            previewsRef.current.add(preview);
            return { key: crypto.randomUUID(), file, preview };
        });
        setQueuedPhotos((current) => [...current, ...next]);
    }

    function removeQueuedPhoto(key) {
        if (busy || recoveryAdId) return;
        const removed = queuedPhotos.find((photo) => photo.key === key);
        if (!removed) return;
        URL.revokeObjectURL(removed.preview);
        previewsRef.current.delete(removed.preview);
        setQueuedPhotos((current) => current.filter((photo) => photo.key !== key));
    }


    function update(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (busy || recoveryAdId) return;

        const desiredStatus = event.nativeEvent.submitter?.value === "PENDING"
            ? "PENDING" : "DRAFT";
        let createdAdId = null;
        setBusy(true);
        setError("");
        setProgress("Сохраняем объявление...");

        try {
            const priceRub = form.price.trim() === "" ? null : Number(form.price);
            if (priceRub !== null &&
                (!Number.isSafeInteger(priceRub) || priceRub < 0 ||
                    priceRub > 1000000000)) {
                throw new Error("Укажите корректную цену.");
            }

            const payload = {
                title: form.title,
                category: form.category,
                description: form.description,
                priceRub,
                location: form.location,
            };
            // A new ad must remain DRAFT while private photos are uploading.
            // Existing ad editing continues to use its current API and photo editor.
            const endpoint = initialAd
                ? `/api/account/ads/${encodeURIComponent(initialAd.id)}`
                : "/api/account/ads";
            const response = await fetch(endpoint, {
                method: initialAd ? "PATCH" : "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...payload,
                    status: initialAd ? desiredStatus : "DRAFT",
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Не удалось сохранить объявление.");
            }

            if (!initialAd) {
                createdAdId = result.ad?.id;
                if (!createdAdId) {
                    throw new Error("Сервер не вернул идентификатор объявления.");
                }

                for (const [index, photo] of queuedPhotos.entries()) {
                    setProgress(`Загружаем фотографию ${index + 1} из ${queuedPhotos.length}...`);
                    const data = new FormData();
                    data.append("file", photo.file);
                    const uploadResponse = await fetch(
                        `/api/account/ads/${encodeURIComponent(createdAdId)}/photos`,
                        { method: "POST", credentials: "same-origin", body: data }
                    );
                    const uploaded = await uploadResponse.json();
                    if (!uploadResponse.ok) {
                        throw new Error(uploaded.error ||
                            `Не удалось загрузить фотографию ${index + 1}.`);
                    }
                }

                if (desiredStatus === "PENDING") {
                    setProgress("Отправляем объявление на модерацию...");
                    const pendingResponse = await fetch(
                        `/api/account/ads/${encodeURIComponent(createdAdId)}`,
                        {
                            method: "PATCH",
                            credentials: "same-origin",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ...payload, status: "PENDING" }),
                        }
                    );
                    const pendingResult = await pendingResponse.json();
                    if (!pendingResponse.ok) {
                        throw new Error(pendingResult.error ||
                            "Не удалось отправить объявление на модерацию.");
                    }
                }
            }

            router.push("/account/ads");
            router.refresh();
        } catch (err) {
            if (createdAdId) setRecoveryAdId(createdAdId);
            setError(err.message || "Ошибка сохранения.");
        } finally {
            setProgress("");
            setBusy(false);
        }
    }

    async function withdraw() {
        if (!initialAd || busy) return;

        setBusy(true);
        setError("");

        try {
            const response = await fetch(
                `/api/account/ads/${encodeURIComponent(initialAd.id)}`,
                {
                    method: "PATCH",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ action: "withdraw" }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Не удалось отозвать объявление."
                );
            }

            router.refresh();
        } catch (err) {
            setError(err.message || "Ошибка отзыва.");
        } finally {
            setBusy(false);
        }
    }

    if (initialAd?.status === "PENDING") {
        return (
            <div>
                <p className={styles.notice}>
                    Объявление находится на модерации.
                    Чтобы изменить его, сначала отзовите
                    заявку. После этого можно исправить
                    текст и отправить повторно.
                </p>

                {error && <p role="alert" className={styles.error}>{error}</p>}

                <button
                    type="button"
                    onClick={withdraw}
                    disabled={busy}
                    className={styles.secondary}
                >
                    {busy ? "Отзываем..." : "Отозвать с модерации"}
                </button>
            </div>
        );
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
                <label htmlFor="ad-title">Название объявления</label>
                <input
                    id="ad-title"
                    type="text"
                    required
                    minLength={5}
                    maxLength={120}
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Например, продам велосипед"
                    className={styles.input}
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="ad-category">Категория</label>
                <select
                    id="ad-category"
                    required
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                    className={styles.input}
                >
                    <option value="">Выберите категорию</option>
                    {AD_CATEGORIES.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.title}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.field}>
                <label htmlFor="ad-description">Описание</label>
                <textarea
                    id="ad-description"
                    required
                    minLength={20}
                    maxLength={5000}
                    rows={7}
                    value={form.description}
                    onChange={(e) =>
                        update("description", e.target.value)
                    }
                    placeholder="Расскажите о товаре или услуге"
                    className={styles.input}
                />
                <small>
                    От 20 до 5000 символов.
                </small>
            </div>

            <div className={styles.field}>
                <label htmlFor="ad-price">Цена, ₽</label>
                <input
                    id="ad-price"
                    type="number"
                    min="0"
                    max="1000000000"
                    step="1"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => update("price", e.target.value)}
                    placeholder="Необязательно"
                    className={styles.input}
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="ad-location">Населённый пункт</label>
                <input
                    id="ad-location"
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    className={styles.input}
                />
            </div>

            {!initialAd && (
                <section className={styles.photoEditor} aria-label="Фотографии объявления">
                    <h2>Фотографии ({queuedPhotos.length}/8)</h2>
                    {queuedPhotos.length > 0 && (
                        <div className={styles.photoGrid}>
                            {queuedPhotos.map((photo, index) => (
                                <div className={styles.photoTile} key={photo.key}>
                                    <Image
                                        src={photo.preview}
                                        alt={`Выбранная фотография ${index + 1}`}
                                        width={160}
                                        height={120}
                                        unoptimized
                                    />
                                    <div className={styles.photoActions}>
                                        <span>{index === 0 ? "Обложка" : `Фото ${index + 1}`}</span>
                                        <button type="button"
                                            onClick={() => removeQueuedPhoto(photo.key)}
                                            disabled={busy || Boolean(recoveryAdId)}>
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {queuedPhotos.length < 8 && (
                        <label className={styles.photoInputLabel}>
                            Добавить фотографии
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                disabled={busy || Boolean(recoveryAdId)}
                                onChange={addQueuedPhotos}
                            />
                        </label>
                    )}
                    <p className={styles.notice}>
                        До 8 фотографий, JPEG/PNG/WebP, не более 5 МБ каждая.
                        Первая фотография станет обложкой. Изображения загрузятся
                        автоматически при сохранении объявления.
                    </p>
                </section>
            )}

            <p className={styles.notice}>
                Для сохранения объявления заполните обязательные поля.
                {initialAd && " Фотографии можно редактировать ниже."}
            </p>

            {progress && <p role="status" className={styles.notice}>{progress}</p>}
            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}
            {recoveryAdId && (
                <p className={styles.notice}>
                    Объявление уже сохранено как черновик. Некоторые действия
                    могли завершиться не полностью. <Link
                        href={`/account/ads/${encodeURIComponent(recoveryAdId)}/edit`}>
                        Открыть черновик и продолжить
                    </Link>.
                </p>
            )}

            <div className={styles.actions}>
                <button
                    type="submit"
                    value="DRAFT"
                    disabled={busy || Boolean(recoveryAdId)}
                    className={styles.secondary}
                >
                    Сохранить черновик
                </button>

                <button
                    type="submit"
                    value="PENDING"
                    disabled={busy || Boolean(recoveryAdId)}
                    className={styles.primary}
                >
                    {busy ? "Обрабатываем..." : "На модерацию"}
                </button>
            </div>
        </form>
    );
}
