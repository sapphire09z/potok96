"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./resource-delete.module.css";

export default function ResourceDeleteButton({ kind, id, title, updatedAt, deleting = false, disabled = false, redirectTo = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = kind === "orgs"
    ? `/api/admin/orgs/${encodeURIComponent(id)}/delete`
    : `/api/account/ads/${encodeURIComponent(id)}/delete`;

  async function remove() {
    if (busy || disabled) return;
    const noun = kind === "orgs" ? "организацию" : "объявление";
    const message = deleting
      ? `Повторить окончательное удаление «${title}»?`
      : `Навсегда удалить ${noun} «${title}» вместе с фотографиями? Это действие нельзя отменить.`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", expectedUpdatedAt: updatedAt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message || "Не удалось удалить запись.");
      router.refresh();
    } finally { setBusy(false); }
  }

  return <span className={styles.wrap}>
    <button type="button" className={styles.button} disabled={busy || disabled} onClick={remove}>
      {busy ? "Удаление…" : deleting ? "Повторить удаление" : "Удалить навсегда"}
    </button>
    {error && <span role="alert" className={styles.error}>{error}</span>}
  </span>;
}
