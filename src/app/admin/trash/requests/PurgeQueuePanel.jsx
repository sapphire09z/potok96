"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../trash.module.css";

const date = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Yekaterinburg", dateStyle: "medium", timeStyle: "short",
});
const formatDate = iso => iso ? date.format(new Date(iso)) : "неизвестно";
const names = { CREATED: "Создана", REQUEUED: "Возобновлена", CHECKED: "Проверена", CANCELLED: "Отменена", PLANNED: "Сформирован план" };
const outcomes = {
  WAITING: "Срок 30 дней не истёк", BLOCKED: "Есть несоответствия", REVIEW: "Проверено, требуется ручное решение",
  STALE: "Заявка устарела",
};

export default function PurgeQueuePanel({ selected, requests }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function perform(kind, id, payload, confirmMessage, key) {
    if (busy) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(key); setError(""); setMessage("");
    try {
      const endpoint = payload.action === "dry-run" ? "plan" : "purge";
      const response = await fetch(`/api/admin/trash/${endpoint}/${kind}/${encodeURIComponent(id)}`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
      if (payload.action === "request") { setReason(""); setMessage("Заявка создана. Удаление не запущено."); }
      if (payload.action === "check") setMessage("Отчёт сохранён. Удаление по-прежнему отключено.");
      if (payload.action === "cancel") setMessage("Заявка отменена.");
      if (payload.action === "dry-run") setMessage("План проверки сохранён. Удаление отключено.");
      router.refresh();
    } catch (e) { setError(e.message || "Операция не выполнена."); }
    finally { setBusy(""); }
  }

  const selectedPending = selected && requests.find(row => row.kind === selected.kind && row.itemId === selected.id &&
    row.trashedAt === selected.trashedAt && row.status === "PENDING");
  return <>
    <section className={styles.history}>
      <h2>Новая заявка</h2>
      {!selected ? <p>Откройте материал из <Link href="/admin/trash">корзины</Link> и выберите «Заявка на очистку».</p> : <>
        <p><strong>{selected.title}</strong> · {selected.kind === "news" ? "Новость" : "Мероприятие"} · в корзине с {formatDate(selected.trashedAt)}</p>
        <p className={styles.meta}>Заявку можно оформить до истечения 30 дней; последующая проверка отметит её как ожидающую. Ни одна заявка не разрешает уничтожение данных.</p>
        {selectedPending ? <p><strong>Ожидающая заявка уже есть.</strong> Ниже можно проверить или отменить её.</p> : <>
          <label htmlFor="purge-reason">Обоснование заявки (10–500 символов)</label>
          <textarea id="purge-reason" rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
            style={{ display: "block", width: "100%", boxSizing: "border-box", margin: "8px 0", padding: 10 }} />
          <button type="button" disabled={Boolean(busy) || reason.trim().length < 10}
            onClick={() => perform(selected.kind, selected.id, {
              action: "request", reason: reason.trim(), expectedUpdatedAt: selected.updatedAt,
              expectedTrashedAt: selected.trashedAt,
            }, "Зарегистрировать заявку? Никакие данные не будут удалены.", "new")}>Создать заявку (без удаления)</button>
        </>}
      </>}
    </section>
    <section className={styles.history}>
      <h2>Последние заявки ({requests.length})</h2>
      {requests.length === 0 ? <p className={styles.meta}>Заявок пока нет.</p> : requests.map(job => <article key={job.id} className={styles.item} style={{ marginBottom: 12 }}>
        <div className={styles.details}>
          <p className={styles.meta}>{job.kind === "news" ? "Новость" : "Мероприятие"} · {job.status === "PENDING" ? "Ожидает" : "Отменена"}</p>
          <h3>{job.title}</h3>
          <p className={styles.meta}>Заявка: {formatDate(job.createdAt)} · материал в корзине с {formatDate(job.trashedAt)}</p>
          <p>Причина: {job.reason}</p>
          {job.lastCheckedAt && job.lastCheck?.outcome && <div>
            <p><strong>Последняя проверка:</strong> {formatDate(job.lastCheckedAt)} · {outcomes[job.lastCheck.outcome] ?? job.lastCheck.outcome}</p>
            <p className={styles.meta}>S3: Private {job.lastCheck.privateCount ?? "?"} файлов, Public {job.lastCheck.publicCount ?? "?"} файлов. Фотографий в БД: {job.lastCheck.imageCount ?? "?"}.</p>
            <p className={styles.meta}>Физическое удаление: заблокировано.</p>
            {Array.isArray(job.lastCheck.issues) && <ul>{job.lastCheck.issues.map((issue,i) => <li key={i}>{issue}</li>)}</ul>}
          </div>}
          {job.plan && <details>
            <summary>Последний план удаления (без выполнения) · {formatDate(job.plan.createdAt)} · {job.plan.status}</summary>
            <p className={styles.meta}>Контрольный SHA-256: <code>{job.plan.digest}</code></p>
            <p>Приватное S3: {job.plan.report?.privateCount ?? "?"} объектов; публичное S3: {job.plan.report?.publicCount ?? "?"} объектов.</p>
            <p><strong>Удаление заблокировано.</strong> План не является разрешением.</p>
            {Array.isArray(job.plan.report?.issues) && <ul>{job.plan.report.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
          </details>}
          {job.events.length > 0 && <details><summary>История заявки ({job.events.length} последних событий)</summary>
            <ol>{job.events.map(event => <li key={event.id}>
              {names[event.action] ?? event.action} · {formatDate(event.createdAt)} · {event.actorId}
              {event.note && <> · {event.note}</>}
            </li>)}</ol></details>}
        </div>
        {job.status === "PENDING" && <div className={styles.restore}>
          <button type="button" disabled={Boolean(busy)} onClick={() => perform(job.kind, job.itemId, {
            action: "dry-run", requestId: job.id, expectedRequestUpdatedAt: job.updatedAt,
          }, null, job.id + ":plan")}>Сформировать план (без удаления)</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => perform(job.kind, job.itemId, {
            action: "check", requestId: job.id, expectedRequestUpdatedAt: job.updatedAt,
          }, null, job.id + ":check")}>Повторно проверить (без удаления)</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => perform(job.kind, job.itemId, {
            action: "cancel", requestId: job.id, expectedRequestUpdatedAt: job.updatedAt,
          }, "Отменить заявку? Материал останется в корзине.", job.id + ":cancel")}>Отменить заявку</button>
        </div>}
      </article>)}
      <p className={styles.meta}>Показаны 40 последних заявок. Полный журнал событий хранится в PostgreSQL.</p>
    </section>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status">{message}</p>}
  </>;
}
