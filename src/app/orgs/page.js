import Link from "next/link";
import { getAllOrgs } from "@/lib/orgs";

export const metadata = {
    title: "Справочник — Поток 96",
};

export default async function OrgsPage() {
    const orgs = await getAllOrgs();

    return (
        <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>Справочник</h1>

            {orgs.map((o) => (
                <article
                    key={o.slug}
                    style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 14,
                        padding: 14,
                        display: "grid",
                        gap: 6,
                    }}
                >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {o.type}
                    </div>

                    <Link href={`/orgs/${o.slug}`} style={{ fontWeight: 700 }}>
                        {o.title}
                    </Link>

                    <div style={{ opacity: 0.86 }}>{o.address}</div>
                </article>
            ))}

            {orgs.length === 0 && <div>Пока пусто</div>}
        </div>
    );
}