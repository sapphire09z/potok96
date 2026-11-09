"use client";

import { useEffect, useRef, useState } from "react";

export default function OwnerRecoveryClient() {
    const [message, setMessage] = useState("Проверяем одноразовую ссылку…");
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const token = hash.get("token");
        // URL fragments are not sent to the web server, and are removed before
        // making the POST request to avoid keeping the recovery token in history.
        window.history.replaceState(null, "", "/owner-recovery");
        if (!token) {
            setMessage("Нет кода восстановления. Создайте ссылку на VPS.");
            return;
        }

        async function recover() {
            try {
                const response = await fetch("/api/owner-recovery", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    cache: "no-store",
                    referrerPolicy: "no-referrer",
                    body: JSON.stringify({ token }),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.redirect !== "/admin") {
                    throw new Error(result.error || "Ссылка недействительна.");
                }
                window.location.replace("/admin");
            } catch (error) {
                setMessage(error.message || "Не удалось войти. Создайте новую ссылку на VPS.");
            }
        }
        recover();
    }, []);

    return <p role="status" aria-live="polite">{message}</p>;
}
