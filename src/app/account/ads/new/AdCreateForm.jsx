
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

    function update(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (busy) return;

        const status =
            event.nativeEvent.submitter?.value === "PENDING"
                ? "PENDING"
                : "DRAFT";

        setBusy(true);
        setError("");

        try {
            const priceRub =
                form.price.trim() === ""
                    ? null
                    : Number(form.price);

            if (
                priceRub !== null &&
                (
                    !Number.isSafeInteger(priceRub) ||
                    priceRub < 0 ||
                    priceRub > 1000000000
                )
            ) {
                throw new Error("Укажите корректную цену.");
            }

            const endpoint = initialAd
                ? `/api/account/ads/${encodeURIComponent(initialAd.id)}`
                : "/api/account/ads";

            const response = await fetch(endpoint, {
                method: initialAd ? "PATCH" : "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: form.title,
                    category: form.category,
                    description: form.description,
                    priceRub,
                    location: form.location,
                    status,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Не удалось сохранить объявление."
                );
            }

            router.push("/account/ads");
            router.refresh();
        } catch (err) {
            setError(err.message || "Ошибка сохранения.");
        } finally {
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

            <p className={styles.notice}>
                Пока для сохранения черновика нужно заполнить
                обязательные поля. Неполные черновики
                добавим при реализации редактирования.
                Загрузка фотографий будет подключена отдельно.
            </p>

            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}

            <div className={styles.actions}>
                <button
                    type="submit"
                    value="DRAFT"
                    disabled={busy}
                    className={styles.secondary}
                >
                    Сохранить черновик
                </button>

                <button
                    type="submit"
                    value="PENDING"
                    disabled={busy}
                    className={styles.primary}
                >
                    {busy ? "Сохраняем..." : "На модерацию"}
                </button>
            </div>
        </form>
    );
}
