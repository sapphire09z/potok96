
"use client";

import { useEffect, useRef, useState } from "react";

function normalizePhone(value) {
    let digits = value.replace(/\D/g, "");

    if (digits.length === 10) digits = "7" + digits;
    if (digits.length === 11 && digits.startsWith("8")) {
        digits = "7" + digits.slice(1);
    }

    return /^7\d{10}$/.test(digits) ? "+" + digits : null;
}

export default function LoginForm({ enabled }) {
    const midRef = useRef(null);
    const busyRef = useRef(false);

    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [stage, setStage] = useState("phone");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        return () => {
            midRef.current?.destroy();
            midRef.current = null;
        };
    }, []);

    async function start(event) {
        event.preventDefault();

        if (!enabled || busyRef.current) return;

        const normalizedPhone = normalizePhone(phone);

        if (!normalizedPhone) {
            setMessage("Введите корректный российский номер.");
            return;
        }

        busyRef.current = true;
        setBusy(true);
        setMessage("");

        try {
            const sdk = await import("smsaero-mobileid-sdk");

            const MobileID =
                sdk.MobileID ??
                sdk.default?.MobileID ??
                sdk.default;

            if (typeof MobileID !== "function") {
                throw new Error("Mobile ID SDK export not found");
            }

            midRef.current?.destroy();

            const mid = new MobileID({
                tokenUrl: "/api/mobile-id/token",
                country: "RU",
            });

            midRef.current = mid;

            mid.on("ready", () => {
                setMessage("Сессия подтверждения создана.");
            });

            mid.on("pending", () => {
                setStage("pending");
                setMessage(
                    "Ожидаем подтверждение через оператора."
                );
            });

            mid.on("otp_required", () => {
                setStage("otp");
                setMessage("Введите код из SMS.");
            });

            mid.on("invalid_code", () => {
                setStage("otp");
                setMessage("Неверный код. Попробуйте ещё раз.");
            });

            mid.on("verified", async ({ verify_token }) => {
                setStage("checking");
                setMessage("Проверяем подтверждение номера.");

                try {
                    const session_id = mid.getSessionId();

                    if (!session_id || !verify_token) {
                        throw new Error("Missing verification data");
                    }

                    const response = await fetch(
                        "/api/mobile-id/siteverify",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                session_id,
                                verify_token,
                            }),
                        }
                    );

                    const result = await response.json();

                    if (!response.ok || result.verified !== true) {
                        throw new Error("Verification rejected");
                    }

                    setStage("verified");
                    setMessage(
                        `Номер ${result.phoneMasked} подтверждён.`
                    );
                } catch {
                    setStage("error");
                    setMessage(
                        "Не удалось подтвердить результат на сервере."
                    );
                }
            });

            mid.on("rejected", () => {
                setStage("error");
                setMessage("Подтверждение отклонено.");
            });

            mid.on("expired", () => {
                setStage("error");
                setMessage("Время подтверждения истекло.");
            });

            mid.on("rate_limit", () => {
                setStage("error");
                setMessage("Превышен лимит запросов.");
            });

            mid.on("error", () => {
                setStage("error");
                setMessage("Ошибка сервиса подтверждения.");
            });

            await mid.init();
            await mid.start(normalizedPhone);
        } catch {
            setStage("error");
            setMessage("Не удалось запустить Mobile ID.");
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    async function submitCode(event) {
        event.preventDefault();

        if (busy || !midRef.current) return;

        if (!/^\d{4,8}$/.test(code)) {
            setMessage("Введите код из SMS.");
            return;
        }

        setBusy(true);

        try {
            await midRef.current.submitOTP(code);
            setStage("pending");
            setMessage("Проверяем код.");
        } catch {
            setStage("otp");
            setMessage("Ошибка проверки кода.");
        } finally {
            setBusy(false);
        }
    }

    function reset() {
        midRef.current?.destroy();
        midRef.current = null;
        setStage("phone");
        setCode("");
        setMessage("");
    }

    const fieldStyle = {
        display: "block",
        width: "100%",
        padding: "13px",
        fontSize: 16,
        margin: "12px 0",
        boxSizing: "border-box",
    };

    if (!enabled) {
        return (
            <p role="status">
                Тестовая авторизация пока отключена.
                Подключение SMS Aero подготовлено.
            </p>
        );
    }

    return (
        <section>
            {stage === "phone" && (
                <form onSubmit={start}>
                    <label htmlFor="login-phone">
                        Номер мобильного телефона
                    </label>

                    <input
                        id="login-phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="+7 999 123-45-67"
                        value={phone}
                        onChange={(event) =>
                            setPhone(event.target.value)
                        }
                        style={fieldStyle}
                        required
                    />

                    <button type="submit" disabled={busy}>
                        {busy ? "Подключаем..." : "Продолжить"}
                    </button>
                </form>
            )}

            {stage === "otp" && (
                <form onSubmit={submitCode}>
                    <label htmlFor="login-otp">
                        Код подтверждения
                    </label>

                    <input
                        id="login-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Код из SMS"
                        value={code}
                        onChange={(event) =>
                            setCode(event.target.value.replace(/\D/g, ""))
                        }
                        maxLength={8}
                        style={fieldStyle}
                        required
                    />

                    <button type="submit" disabled={busy}>
                        Подтвердить код
                    </button>
                </form>
            )}

            {message && (
                <p role="status" aria-live="polite">
                    {message}
                </p>
            )}

            {stage === "verified" && (
                <p>
                    Проверка успешна. Создание аккаунта
                    и вход в личный кабинет подключим
                    на следующем этапе.
                </p>
            )}

            {stage !== "phone" && stage !== "verified" && (
                <button type="button" onClick={reset}>
                    Начать заново
                </button>
            )}
        </section>
    );
}
