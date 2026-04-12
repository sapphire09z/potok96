import Link from "next/link";
import { getAllNews } from "@/lib/news";

export default async function NewsCategoryPage({ params }) {
    const { category: raw } = await params;
    const category = decodeURIComponent(raw);

    const all = await getAllNews();
    const news = all.filter((n) => (n.category ?? "город") === category);

    return (
        <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
                <Link href="/news">← Все новости</Link>
            </div>

            <h1 style={{ margin: 0, fontSize: 26 }}>Рубрика: {category}</h1>

            {news.map((n) => (
                <article
                    key={n.slug}
                    style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 14,
                        padding: 14,
                        display: "grid",
                        gap: 6,
                    }}
                >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{n.date}</div>
                    <Link href={`/news/${n.slug}`} style={{ fontWeight: 700 }}>
                        {n.title}
                    </Link>
                    <div style={{ opacity: 0.86 }}>{n.summary}</div>
                </article>
            ))}

            {news.length === 0 && <div style={{ opacity: 0.7 }}>Пока пусто.</div>}
        </div>
    );
}
