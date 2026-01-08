import Link from "next/link";
import { getAllNews } from "@/lib/news";

export const metadata = {
    title: "Новости — Поток 96",
    description: "Городские новости Красноуфимска и района.",
};

export default async function NewsListPage() {
    const news = await getAllNews();

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>Новости</h1>

            {news.map((n) => (
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

            {news.length === 0 && (
                <div style={{ opacity: 0.7 }}>
                    Пока нет опубликованных новостей (status: published).
                </div>
            )}
        </div>
    );
}