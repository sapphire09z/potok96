import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/orgs";
import ReactMarkdown from "react-markdown";

export default async function OrgPage({ params }) {
    const { slug } = await params;
    const org = await getOrgBySlug(slug);

    if (!org || org.status !== "published") notFound();

    return (
        <article style={{ display: "grid", gap: 12, maxWidth: 720 }}>
            <h1 style={{ margin: 0 }}>{org.title}</h1>

            <div style={{ opacity: 0.7 }}>{org.type}</div>

            <div><b>Адрес:</b> {org.address}</div>
            <div><b>Телефон:</b> {org.phone}</div>
            <div><b>Время:</b> {org.hours}</div>

            <div style={{ lineHeight: 1.6 }}>
                <ReactMarkdown>{org.content}</ReactMarkdown>
            </div>
        </article>
    );
}