"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { yekatDateTimeInput } from "@/lib/newsPublication.mjs";
import styles from "./review.module.css";

export default function ReviewActions({ postId, status, updatedAt, isAdmin, issues = [], scheduled = false, publishedAt = null }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [publicationDate, setPublicationDate] = useState(() => scheduled ? yekatDateTimeInput(publishedAt) : "");

    async function execute(action, withDate = false) {
        if (busy) return;
        if (withDate && !publicationDate) {
            setError("Выберите дату и время публикации по Красноуфимску."); return;
        }
        const description = {
            submit: "отправить на проверку", approve: "одобрить", return: "вернуть на доработку",
            reopen: "вернуть в черновики", reopen_unpublished: "отправить на доработку",
            publish: withDate ? "опубликовать на указанную дату" : "опубликовать сейчас",
            unpublish: scheduled ? "отменить запланированную публикацию" : "снять с публикации",
            republish: withDate ? "повторно опубликовать на указанную дату" : "повторно опубликовать",
            reschedule: "изменить время запланированной публикации",
        }[action];
        if (!window.confirm(`Действительно ${description} этот материал?`)) return;
        setBusy(true); setError("");
        try {
            const publication = ["publish", "unpublish", "republish", "reschedule"].includes(action);
            const endpoint = publication ? "publication" : "workflow";
            const response = await fetch(`/api/editor/news/${encodeURIComponent(postId)}/${endpoint}`, {
                method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason, expectedUpdatedAt: updatedAt,
                    ...(withDate ? { publicationDate } : {}) }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `Ошибка ${response.status}`);
            setReason("");
            router.refresh();
        } catch (err) { setError(err.message || "Не удалось изменить статус."); }
        finally { setBusy(false); }
    }

    return <section className={styles.actions} aria-label="Редакционное решение">
        {status === "DRAFT" && <>
            <p>Перед отправкой проверьте текст, источник и права на фотографии. Сохраните все изменения: после отправки материал будет закрыт для редактирования до возврата.</p>
            {issues.length > 0 ? <div className={styles.readiness} role="alert">
                <strong>Перед отправкой исправьте:</strong>
                <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                <Link href={`/editor/news/${postId}`}>Перейти к исправлению черновика</Link>
            </div> : <p className={styles.ready}>Обязательные сведения заполнены. Можно отправлять на проверку.</p>}
            <button type="button" disabled={busy || issues.length > 0} onClick={() => execute("submit")}>Отправить на проверку</button>
        </>}
        {status === "REVIEW" && !isAdmin && <p>Материал ожидает решения администратора.</p>}
        {status === "REVIEW" && isAdmin && <>
            <p>Обязательные сведения уже проверялись перед отправкой. Оцените содержание, корректность ссылок и достоверность предоставленных разрешений. Одобрение пока не публикует статью на сайте.</p>
            {issues.length > 0 && <div className={styles.readiness} role="alert">
                <strong>Обнаружены недостающие сведения — верните материал на доработку:</strong>
                <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>}
            <button type="button" disabled={busy || issues.length > 0} onClick={() => execute("approve")}>Одобрить для публикации</button>
            <label>Причина возврата на доработку (не менее 5 символов)
                <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Что исправить в материале…" />
            </label>
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("return")}>Вернуть на доработку</button>
        </>}
        {status === "APPROVED" && <>
            <p>Материал одобрен, но ещё не опубликован. Только администратор может открыть его на сайте.</p>
            {isAdmin && <>
                <button type="button" disabled={busy} onClick={() => execute("publish")}>Опубликовать сейчас</button>
                <label>Дата и время публикации (Красноуфимск, UTC+5)
                    <input type="datetime-local" value={publicationDate} onChange={(event) => setPublicationDate(event.target.value)} disabled={busy} />
                </label>
                <p>Дата в будущем — отложенная публикация. Дата в прошлом — публикация задним числом. Время указывайте по Красноуфимску.</p>
                <button type="button" disabled={busy || !publicationDate} onClick={() => execute("publish", true)}>Опубликовать на указанную дату / запланировать</button>
                <label>Причина возврата в черновики
                    <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("reopen")}>Вернуть в черновики</button>
            </>}
        </>}
        {status === "PUBLISHED" && <>
            <p>{scheduled ? "Выход новости запланирован. До указанного времени она недоступна посетителям, в поиске и по прямой ссылке." : "Новость доступна на сайте."}</p>
            {isAdmin && <>
                {scheduled && <>
                    <label>Изменить запланированную дату и время (Красноуфимск, UTC+5)
                        <input type="datetime-local" value={publicationDate} onChange={(event) => setPublicationDate(event.target.value)} disabled={busy} />
                    </label>
                    <button type="button" disabled={busy || !publicationDate} onClick={() => execute("reschedule", true)}>Перенести время выхода</button>
                </>}
                <label>{scheduled ? "Причина отмены публикации (не менее 5 символов)" : "Причина снятия с публикации (не менее 5 символов)"}
                    <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("unpublish")}>{scheduled ? "Отменить запланированную публикацию" : "Снять с публикации"}</button>
            </>}
        </>}
        {status === "UNPUBLISHED" && <>
            <p>Новость скрыта из публичной ленты. Администратор может вернуть её без изменений либо отправить на доработку.</p>
            {isAdmin && <>
                <button type="button" disabled={busy} onClick={() => execute("republish")}>Повторно опубликовать (с прежней датой)</button>
                <label>Новая дата и время публикации (Красноуфимск, UTC+5)
                    <input type="datetime-local" value={publicationDate} onChange={(event) => setPublicationDate(event.target.value)} disabled={busy} />
                </label>
                <p>Можно выбрать дату в прошлом или запланировать повторный выход на будущее.</p>
                <button type="button" disabled={busy || !publicationDate} onClick={() => execute("republish", true)}>Опубликовать на указанную дату / запланировать</button>
                <label>Причина возврата на доработку
                    <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("reopen_unpublished")}>Вернуть в черновики</button>
            </>}
        </>}

        {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>;
}
