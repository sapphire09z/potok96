export const metadata = {
    title: "О проекте — Поток 96",
    description: "Что такое Поток 96 и как прислать новость или событие.",
};

export default function AboutPage() {
    return (
        <div style={{ display: "grid", gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>О проекте</h1>

            <p style={{ margin: 0, opacity: 0.85 }}>
                Поток 96 — городской онлайн-проект про Красноуфимск и район: новости, афиша,
                люди, бизнес, работа, молодёжные инициативы.
            </p>

            <section>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Как прислать новость</h2>
                <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.85 }}>
                    <li>Текст (что, где, когда, кто организатор)</li>
                    <li>1–3 фото (если есть)</li>
                    <li>Контакты для уточнений</li>
                </ul>
            </section>

            <section>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Контакты</h2>
                <p style={{ margin: 0, opacity: 0.85 }}>
                    Пока временно: <b>potok66@local</b> (заменим на реальные позже)
                </p>
            </section>
        </div>
    );
}
