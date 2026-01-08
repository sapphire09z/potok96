import { notFound } from "next/navigation";
import { getNewsBySlug } from "@/lib/news";

export default async function NewsItemPage({ params }) {
    const { slug } = await params;
    const post = await getNewsBySlug(slug);

    if (!post || post.status !== "published") {
        notFound();
    }

    return (
        <article style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{post.date}</div>

            <h1 style={{ margin: 0, fontSize: 26 }}>{post.title}</h1>

            {/* пока выводим markdown как обычный текст */}
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.9 }}>
        {post.content}
      </pre>
        </article>
    );
}
