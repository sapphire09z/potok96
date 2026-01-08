import { notFound } from "next/navigation";
import { getNewsBySlug } from "@/lib/news";
import ReactMarkdown from "react-markdown";
import styles from "./article.module.css";

export default async function NewsItemPage({ params }) {
    const { slug } = await params;
    const post = await getNewsBySlug(slug);

    if (!post || post.status !== "published") {
        notFound();
    }

    return (
        <article className={styles.article}>
            <div className={styles.meta}>{post.date}</div>
            <h1 className={styles.title}>{post.title}</h1>
            <div className={styles.content}>
                <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
        </article>
    );
}
