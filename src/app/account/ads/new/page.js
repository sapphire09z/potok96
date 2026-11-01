
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session.js";
import AdCreateForm from "./AdCreateForm.jsx";
import styles from "../ads.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Подать объявление",
    robots: {
        index: false,
        follow: false,
    },
};

export default async function NewAdPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <div className={styles.page}>
            <Link href="/account/ads" className={styles.back}>
                ← Мои объявления
            </Link>

            <h1>Подать объявление</h1>

            <p className={styles.lead}>
                Заполните информацию и сохраните черновик
                или отправьте объявление на проверку.
            </p>

            <AdCreateForm />

            <p className={styles.notice}>
                Контактным телефоном объявления будет
                подтверждённый номер вашего аккаунта.
                После одобрения объявления он станет
                доступен посетителям сайта.
            </p>
        </div>
    );
}
