"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import styles from "../../ads.module.css";

export default function AdPhotoUploader({ adId, photos, canUpload }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file || !canUpload || busy) return;

    setError("");
    if (file.size > 5 * 1024 * 1024 || file.size === 0) {
      setError("Выберите фотографию размером до 5 МБ.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch(
        `/api/account/ads/${encodeURIComponent(adId)}/photos`,
        { method: "POST", credentials: "same-origin", body: form }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Не удалось загрузить фотографию.");
      }
      router.refresh();
    } catch (err) {
      setError(err.message || "Ошибка загрузки.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className={styles.photoEditor} aria-label="Фотографии объявления">
      <h2>Фотографии ({photos.length}/8)</h2>
      <div className={styles.photoGrid}>
        {photos.map((photo, index) => (
          <div className={styles.photoTile} key={photo.id}>
            <Image
              src={`/api/account/ads/${encodeURIComponent(adId)}/photos/${encodeURIComponent(photo.id)}?size=320`}
              alt={`Фотография ${index + 1}`}
              width={160}
              height={120}
              unoptimized
            />
          </div>
        ))}
      </div>
      {canUpload && photos.length < 8 && (
        <label className={styles.photoInputLabel}>
          {busy ? "Загружаем фотографию..." : "Добавить фотографию"}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload}
            disabled={busy}
          />
        </label>
      )}
      <p className={styles.notice}>
        До 8 фотографий, JPEG/PNG/WebP, не более 5 МБ каждая.
        Файлы пока хранятся приватно и не отображаются на общей доске.
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
