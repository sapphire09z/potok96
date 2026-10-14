import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { formatDate } from "@/lib/date";
import { getAllNews, getNewsBySlug } from "@/lib/news";
import { getOrgBySlug } from "@/lib/orgs";

import styles from "./article.module.css";

export default async function NewsItemPage({ params }) {
    const { slug } = await params;

    const post = await getNewsBySlug(slug);

    if (!post || post.status !== "published") {
        notFound();
    }

    const [relatedOrg, allNews] = await Promise.all([
        post.org ? getOrgBySlug(post.org) : null,
        getAllNews(),
    ]);

    const relatedPosts = allNews
        .filter((item) => item.status === "published")
        .filter((item) => item.slug !== post.slug)
        .filter((item) => item.category === post.category)
        .slice(0, 3);

    return (
        <article className={styles.page}>
            <header className={styles.header}>
                <div className={styles.kicker}>{post.category}</div>

                <h1>{post.title}</h1>

                {post.summary && <p className={styles.lead}>{post.summary}</p>}

                <div className={styles.meta}>
                    <span>{post.author}</span>
                    <span>•</span>
                    <span>{formatDate(post.date)}</span>
                </div>

                {relatedOrg && (
                    <div className={styles.orgBox}>
                        <span>Организация: </span>
                        <Link href={`/orgs/${relatedOrg.slug}`}>{relatedOrg.title}</Link>
                    </div>
                )}
            </header>

            <section className={styles.content}>
                <ReactMarkdown>{post.content}</ReactMarkdown>
            </section>

            {post.tags?.length > 0 && (
                <section className={styles.tags}>
                    {post.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                    ))}
                </section>
            )}

            {relatedPosts.length > 0 && (
                <section className={styles.related}>
                    <div className={styles.sectionHeader}>
                        <h2>Ещё по теме</h2>
                        <span>{relatedPosts.length}</span>
                    </div>

                    <div className={styles.relatedList}>
                        {relatedPosts.map((item) => (
                            <Link
                                key={item.slug}
                                href={`/news/${item.slug}`}
                                className={styles.relatedItem}
                            >
                                <div>
                                    <h3>{item.title}</h3>

                                    {item.summary && <p>{item.summary}</p>}
                                </div>

                                {item.date && (
                                    <span className={styles.date}>{formatDate(item.date)}</span>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}