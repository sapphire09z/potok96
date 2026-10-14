import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { getAllNews, getNewsBySlug } from "@/lib/news";
import { getOrgBySlug } from "@/lib/orgs";

import styles from "./article.module.css";

export default async function NewsItemPage({ params }) {
    const { slug } = await params;

    const post = await getNewsBySlug(slug);

    if (!post || post.status !== "published") {
        notFound();
    }

    const relatedOrg = post.org ? await getOrgBySlug(post.org) : null;

    const allNews = await getAllNews();

    const relatedPosts = allNews
        .filter((item) => item.status === "published")
        .filter((item) => item.slug !== post.slug)
        .filter((item) => item.category === post.category)
        .slice(0, 3);

    return (
        <article className={styles.article}>
            <div className={styles.category}>{post.category}</div>

            <h1 className={styles.title}>{post.title}</h1>

            {post.summary && <p className={styles.lead}>{post.summary}</p>}

            <div className={styles.meta}>
                <span>{post.author}</span>
                <span>•</span>
                <span>{post.date}</span>
            </div>

            {relatedOrg && (
                <div className={styles.orgBox}>
                    <span>Организация: </span>
                    <Link href={`/orgs/${relatedOrg.slug}`}>{relatedOrg.title}</Link>
                </div>
            )}

            <div className={styles.content}>
                <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>

            {post.tags?.length > 0 && (
                <div className={styles.tags}>
                    {post.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>
              #{tag}
            </span>
                    ))}
                </div>
            )}

            {relatedPosts.length > 0 && (
                <section className={styles.related}>
                    <h2>Ещё по теме</h2>

                    <div className={styles.relatedList}>
                        {relatedPosts.map((item) => (
                            <Link
                                key={item.slug}
                                href={`/news/${item.slug}`}
                                className={styles.relatedItem}
                            >
                                <div className={styles.relatedTitle}>{item.title}</div>

                                {item.summary && (
                                    <div className={styles.relatedSummary}>{item.summary}</div>
                                )}

                                <div className={styles.relatedDate}>{item.date}</div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}