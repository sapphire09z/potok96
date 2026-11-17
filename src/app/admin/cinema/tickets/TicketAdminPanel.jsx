"use client";
import { useState } from "react";
import styles from "./tickets-admin.module.css";

const dates = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
});
// Suggested addresses only. Nothing is published until the administrator saves.
const suggestions = {
    "Морозко": "https://kinokruf.ru/schedule/cmb7uitmphlta0829m1gru88b",
    "Рождение империи": "https://kinokruf.ru/schedule/cmlhjr8aeauk20829j09mlc11",
    "Приключения пингвиненка": "https://kinokruf.ru/schedule/cm9qvxeiwg2k90829fewwuhuf",
};
function TicketRow({ initial }) {
    const [url, setUrl] = useState(initial.ticketPageUrl);
    const [revision, setRevision] = useState(initial.updatedAt);
    const [working, setWorking] = useState(false);
    const [notice, setNotice] = useState("");
    const [saved, setSaved] = useState(false);
    async function save(event) {
        event.preventDefault(); setNotice(""); setSaved(false); setWorking(true);
        try {
            const response = await fetch(`/api/admin/cinema/tickets/${initial.id}`, {
                method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketPageUrl: url.trim(), expectedUpdatedAt: revision }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Не удалось сохранить адрес.");
            setRevision(result.updatedAt); setUrl(result.ticketPageUrl);
            setSaved(true); setNotice(result.ticketPageUrl ? "Адрес фильма сохранён." : "Ссылка на билеты отключена.");
        } catch (cause) { setNotice(cause.message); }
        finally { setWorking(false); }
    }
    const suggestion = suggestions[initial.title];
    return <form onSubmit={save} className={styles.card}>
        <div className={styles.cardHead}>
            <div><h3>{initial.title}</h3>
                <p>ID фильма: {initial.id}{initial.nearestScreening && ` · Ближайший сеанс ${dates.format(new Date(initial.nearestScreening))}`}</p>
            </div>
            <span className={initial.pushkinCard ? styles.success : styles.muted}>
                {initial.pushkinCard ? `Пушкинская карта · ID ${initial.pushkinId}` : "Без отметки «Пушкинская карта»"}
            </span>
        </div>
        <label className={styles.field}>Страница фильма на kinokruf.ru
            <input type="url" value={url} disabled={working} maxLength={2048}
                onChange={e => { setUrl(e.target.value); setSaved(false); }}
                placeholder="https://kinokruf.ru/schedule/cmb7uitmphlta0829m1gru88b" />
        </label>
        {suggestion && !initial.ticketPageUrl && <p className={styles.muted}>
            Найденная страница: <a href={suggestion} target="_blank" rel="noopener noreferrer">проверить фильм на kinokruf.ru</a>.
            Вставьте адрес в поле и сохраните только после сверки.
        </p>}
        <div className={styles.cardBottom}>
            <span className={saved ? styles.success : styles.muted} role="status">
                {notice || "Дата выбирается автоматически; время сеанса посетитель выбирает на сайте кинотеатра."}
            </span>
            <button type="submit" disabled={working}>{working ? "Сохранение…" : "Сохранить"}</button>
        </div>
    </form>;
}
export default function TicketAdminPanel({ initialItems }) {
    const [onlyPushkin, setOnlyPushkin] = useState(false);
    const visible = onlyPushkin ? initialItems.filter(movie => movie.pushkinCard) : initialItems;
    return <section>
        <div className={styles.toolbar}>
            <p>Фильмов с будущими сеансами: {initialItems.length}. С Пушкинской картой: {initialItems.filter(x => x.pushkinCard).length}.</p>
            <label><input type="checkbox" checked={onlyPushkin} onChange={e => setOnlyPushkin(e.target.checked)} /> Только с Пушкинской картой</label>
        </div>
        {!visible.length ? <p>Фильмов с выбранным условием нет.</p> :
            <div className={styles.cards}>{visible.map(movie => <TicketRow key={movie.id} initial={movie} />)}</div>}
    </section>;
}
