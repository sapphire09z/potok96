
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Личный кабинет",
    robots: {
        index: false,
        follow: false,
    },
};

export default async function AccountPage() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <main
            style={{
                maxWidth: 720,
                margin: "48px auto",
                padding: "0 20px 60px",
            }}
        >
            <h1>Личный кабинет</h1>

            <p>Вы вошли в Поток 96.</p>

            <section>
                <h2>Профиль</h2>

                <p>
                    <strong>Телефон:</strong> {user.phone}
                </p>

                <p>
                    <strong>Роль:</strong> {user.role}
                </p>
            </section>

            <section style={{ marginTop: 32 }}>
                <h2>Мои объявления</h2>

                <p>
                    Управление объявлениями подключим
                    на следующем этапе.
                </p>

                <Link href="/ads">
                    Перейти к объявлениям
                </Link>
            </section>

            <form
                action="/api/auth/logout"
                method="post"
                style={{ marginTop: 32 }}
            >
                <button type="submit">
                    Выйти из аккаунта
                </button>
            </form>
        </main>
    );
}
