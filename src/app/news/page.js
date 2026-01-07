import Link from "next/link";

export const metadata = {
    title: "Новости — Поток 96",
    description: "Городские новости Красноуфимска и района.",
};

const mockNews = [
    {
        slug: "potok-start",
        title: "Поток 96: старт проекта",
        date: "2026-01-07",
        summary: "Запускаем городской портал и соцплощадки.",
    },
    {
        slug: "afisha-week",
        title: "Афиша недели: что происходит в городе",
        date: "2026-01-07",
        summary: "Подборка ближайших событий и активностей.",
    },
];

export default function NewsListPage() {
    return (
        <div style={{ display: "grid", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>Новости</h1>

            {mockNews.map((n) => (
                <article
                    key={n.slug}
                    style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        display: "grid",
                        gap: 6,
                    }}
                >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{n.date}</div>

                    <Link href={`/news/${n.slug}`} style={{ fontWeight: 700 }}>
                        {n.title}
                    </Link>

                    <div style={{ opacity: 0.85 }}>{n.summary}</div>
                </article>
            ))}
        </div>
    );
}
