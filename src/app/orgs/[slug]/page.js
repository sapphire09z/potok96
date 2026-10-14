import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { getOrgBySlug } from "@/lib/orgs";
import { getAllEvents } from "@/lib/events";
import { getAllNews } from "@/lib/news";

export default async function OrgPage({ params }) {
    const { slug } = await params;

    const org = await getOrgBySlug(slug);

    if (!org || org.status !== "published") {
        notFound();
    }

    const [events, news] = await Promise.all([
        getAllEvents(),
        getAllNews(),
    ]);

    const relatedEvents = events.filter((event) => event.org === org.slug);
    const relatedNews = news.filter((post) => post.org === org.slug);

    return (
        <article style={{ display: "grid", gap: 12, maxWidth: 720 }}>
            <h1 style={{ margin: 0 }}>{org.title}</h1>

            <div style={{ opacity: 0.7 }}>{org.type}</div>

            <div>
                <b>Адрес:</b> {org.address}
            </div>

            <div>
                <b>Телефон:</b> {org.phone}
            </div>

            <div>
                <b>Время:</b> {org.hours}
            </div>

            <div style={{ lineHeight: 1.6 }}>
                <ReactMarkdown>{org.content}</ReactMarkdown>
            </div>

            {relatedEvents.length > 0 && (
                <section style={{ marginTop: 20 }}>
                    <h3>События</h3>

                    <div style={{ display: "grid", gap: 8 }}>
                        {relatedEvents.map((event) => (
                            <div key={event.slug}>
                                <Link href={`/events/${event.slug}`}>
                                    {event.title}
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {relatedNews.length > 0 && (
                <section style={{ marginTop: 20 }}>
                    <h3>Новости организации</h3>

                    <div style={{ display: "grid", gap: 8 }}>
                        {relatedNews.map((post) => (
                            <div key={post.slug}>
                                <Link href={`/news/${post.slug}`}>
                                    {post.title}
                                </Link>

                                {post.date && (
                                    <div style={{ fontSize: 14, opacity: 0.65 }}>
                                        {post.date}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}