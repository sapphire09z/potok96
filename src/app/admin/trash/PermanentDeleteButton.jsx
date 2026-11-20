"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./trash.module.css";

export default function PermanentDeleteButton({ item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function purge() {
    if (busy) return;
    const question = item.deleting
      ? `Повторить окончательное удаление «${item.title}»?`
      : `Навсегда удалить «${item.title}»? Будут удалены запись, связанные комментарии, редакционная история и файлы S3. Отменить это действие нельзя.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/trash/delete/${item.kind}/${encodeURIComponent(item.id)}`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", expectedUpdatedAt: item.updatedAt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || `Ошибка ${response.status}`);
    } catch (err) {
      setError(err.message || "Не удалось завершить удаление.");
    } finally {
      setBusy(false);
      // Reload version and purgeStartedAt after a partial failure so retry is possible.
      router.refresh();
    }
  }

  return <>
    <button type="button" className={styles.danger} disabled={busy} onClick={purge}>
      {busy ? "Удаление…" : item.deleting ? "Повторить удаление" : "Удалить навсегда"}
    </button>
    {error && <span role="alert" className={styles.error}>{error}</span>}
  </>;
}
