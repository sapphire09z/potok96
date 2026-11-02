
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import AdCreateForm from "../../new/AdCreateForm";
import styles from "../../ads.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Редактирование объявления",
    robots: { index: false, follow: false },
};

export default async function EditAdPage({ params }) {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    const { id } = await params;

    const ad = await getPrisma().classifiedAd.findFirst({
        where: {
            id,
            ownerId: user.id,
        },
        select: {
            id: true,
            title: true,
            category: true,
            description: true,
            location: true,
            priceRub: true,
            status: true,
        },
    });

    if (!ad) {
        notFound();
    }

    const editable = ["DRAFT", "REJECTED", "PENDING"]
        .includes(ad.status);

    return (
        <div className={styles.page}>
            <Link href="/account/ads" className={styles.back}>
                ← Мои объявления
            </Link>

            <h1>Редактирование объявления</h1>

            {editable ? (
                <AdCreateForm initialAd={ad} />
            ) : (
                <p className={styles.notice}>
                    Объявление с текущим статусом
                    недоступно для редактирования.
                </p>
            )}
        </div>
    );
}
