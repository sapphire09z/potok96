"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./review.module.css";

export default function ReviewActions({ postId, status, updatedAt, isAdmin, issues = [] }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    async function execute(action) {
        if (busy) return;
        const description = {
            submit: "отправить на проверку", approve: "одобрить", return: "вернуть на доработку",
            reopen: "вернуть в черновики", reopen_unpublished: "отправить на доработку",
            publish: "опубликовать на сайте", unpublish: "снять с публикации", republish: "повторно опубликовать",
        }[action];
        if (!window.confirm(`Действительно ${description} этот материал?`)) return;
        setBusy(true); setError("");
        try {
            const publication = ["publish", "unpublish", "republish"].includes(action);
            const endpoint = publication ? "publication" : "workflow";
            const response = await fetch(`/api/editor/news/${encodeURIComponent(postId)}/${endpoint}`, {
                method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason, expectedUpdatedAt: updatedAt }),
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
                <button type="button" disabled={busy} onClick={() => execute("publish")}>Опубликовать на сайте</button>
                <label>Причина возврата в черновики
                    <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("reopen")}>Вернуть в черновики</button>
            </>}
        </>}
        {status === "PUBLISHED" && <>
            <p>Новость доступна на сайте.</p>
            {isAdmin && <>
                <label>Причина снятия с публикации (не менее 5 символов)
                    <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("unpublish")}>Снять с публикации</button>
            </>}
        </>}
        {status === "UNPUBLISHED" && <>
            <p>Новость скрыта из публичной ленты. Администратор может вернуть её без изменений либо отправить на доработку.</p>
            {isAdmin && <>
                <button type="button" disabled={busy} onClick={() => execute("republish")}>Повторно опубликовать</button>
                <label>Причина возврата на доработку
                    <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => execute("reopen_unpublished")}>Вернуть в черновики</button>
            </>}
        </>}

        {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>;
}
