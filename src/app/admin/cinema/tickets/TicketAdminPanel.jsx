"use client";
import { useState } from "react";
import styles from "./tickets-admin.module.css";

const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
});
function TicketRow({ initial }) {
    const [confirmed, setConfirmed] = useState(initial.pushkinConfirmed);
    const [note, setNote] = useState(initial.pushkinProofNote);
    const [url, setUrl] = useState(initial.ticketUrl);
    const [working, setWorking] = useState(false);
    const [notice, setNotice] = useState("");
    const [saved, setSaved] = useState(false);
    async function save(event) {
        event.preventDefault();
        setNotice(""); setSaved(false); setWorking(true);
        try {
            const response = await fetch(`/api/admin/cinema/tickets/${initial.id}`, {
                method: "PUT", credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pushkinConfirmed: confirmed,
                    pushkinProofNote: note, ticketUrl: url.trim() }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Ошибка сохранения.");
            setUrl(result.ticketUrl); setSaved(true); setNotice("Сохранено для этого сеанса.");
        } catch (cause) { setNotice(cause.message); }
        finally { setWorking(false); }
    }
    return <form onSubmit={save} className={styles.card}>
        <div className={styles.cardHead}>
            <div>
                <h3>{initial.movieTitle}</h3>
                <p>{fmt.format(new Date(initial.startAt))} · {initial.hallName || "Зал не указан"} · ID {initial.id}</p>
            </div>
            {initial.needsReview && <span className={styles.warning}>Данные изменились — требуется перепроверка</span>}
        </div>
        <label className={styles.check}>
            <input type="checkbox" checked={confirmed} disabled={!initial.pushkinId || working}
                onChange={e => { setConfirmed(e.target.checked); setSaved(false); }} />
            Подтверждена «Пушкинская карта»
            <span className={styles.muted}>{initial.pushkinId ? `PushkinId: ${initial.pushkinId}` : "В API нет PushkinId"}</span>
        </label>
        <label className={styles.field}>Источник подтверждения
            <input type="text" maxLength={500} value={note} disabled={working}
                onChange={e => { setNote(e.target.value); setSaved(false); }}
                placeholder="Например, проверено в личном кабинете PRO.Культура" />
        </label>
        <label className={styles.field}>Официальная ссылка на покупку конкретного сеанса
            <input type="url" value={url} disabled={working} maxLength={2048}
                onChange={e => { setUrl(e.target.value); setSaved(false); }}
                placeholder="https://kinokruf.ru/..." />
        </label>
        <div className={styles.cardBottom}>
            <span className={saved ? styles.success : styles.muted} role="status">{notice || "Ссылка должна вести на конкретный сеанс, а не на главную страницу."}</span>
            <button type="submit" disabled={working}>{working ? "Сохранение…" : "Сохранить"}</button>
        </div>
    </form>;
}
export default function TicketAdminPanel({ initialItems }) {
    const [onlyPushkin, setOnlyPushkin] = useState(false);
    const visible = onlyPushkin ? initialItems.filter(item => item.pushkinId) : initialItems;
    return <section>
        <div className={styles.toolbar}>
            <p>Будущих сеансов: {initialItems.length}. С PushkinId: {initialItems.filter(x => x.pushkinId).length}.</p>
            <label><input type="checkbox" checked={onlyPushkin} onChange={e=>setOnlyPushkin(e.target.checked)}/> Только с PushkinId</label>
        </div>
        {!visible.length ? <p>Сеансов с выбранным условием нет.</p> :
            <div className={styles.cards}>{visible.map(item=><TicketRow key={item.id} initial={item}/>)}</div>}
    </section>;
}
