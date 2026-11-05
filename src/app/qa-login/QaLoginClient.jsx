"use client";

import { useEffect, useState } from "react";

export default function QaLoginClient() {
    const [message, setMessage] = useState("Проверяем одноразовую ссылку…");

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const token = params.get("token");

        // The token must never be sent in the HTTP URL or kept in browser history.
        window.history.replaceState(null, "", "/qa-login");

        if (!token) {
            setMessage("В ссылке нет кода. Сгенерируйте новую на VPS.");
            return;
        }

        let active = true;

        async function redeem() {
            try {
                const response = await fetch("/api/qa-login", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("Ссылка недействительна, уже использована или просрочена.");
                }

                const data = await response.json();
                if (active) {
                    window.location.replace(data.redirect === "/moderator/ads"
                        ? "/moderator/ads"
                        : "/account");
                }
            } catch {
                if (active) {
                    setMessage("Войти не удалось. Создайте новую ссылку на VPS.");
                }
            }
        }

        redeem();
        return () => { active = false; };
    }, []);

    return <p role="status" aria-live="polite">{message}</p>;
}
