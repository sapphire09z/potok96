import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { isNewsEditor } from "@/lib/newsDraft";
import NewsDraftForm from "../NewsDraftForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Редактирование новости — Редакция", robots: { index: false, follow: false } };

export default async function EditNewsPage({ params }) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!isNewsEditor(user)) notFound();

    const { id } = await params;
    if (typeof id !== "string" || !/^c[a-z0-9]{10,40}$/.test(id)) notFound();

    const post = await getPrisma().newsPost.findUnique({
        where: { id },
        select: {
            id: true, title: true, slug: true, summary: true, body: true,
            category: true, authorName: true, tags: true, cover: true,
            sourceName: true, sourceUrl: true, sourceText: true, status: true,
        },
    });

    if (!post || post.status !== "DRAFT") notFound();
    return <NewsDraftForm initialPost={post} />;
}
