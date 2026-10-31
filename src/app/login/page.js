
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Вход",
    description: "Вход в Поток 96 по номеру телефона",
    robots: {
        index: false,
        follow: false,
    },
};

export default function LoginPage() {
    const enabled =
        process.env.SMSAERO_MOBILEID_TEST_ENABLED === "true";

    return (
        <main style={{
            maxWidth: 460,
            margin: "48px auto",
            padding: "0 20px 60px",
        }}>
            <h1>Вход в Поток 96</h1>
            <p>
                Для входа или регистрации достаточно
                подтвердить номер мобильного телефона.
            </p>

            <LoginForm enabled={enabled} />
        </main>
    );
}
