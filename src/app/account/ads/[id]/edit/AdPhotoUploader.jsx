"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "../../ads.module.css";

export default function AdPhotoUploader({ adId, photos, canUpload }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [orderedPhotos, setOrderedPhotos] = useState(photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setOrderedPhotos(photos);
  }, [photos]);

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file || !canUpload || busy) return;

    setError("");
    setNotice("");
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

  async function move(index, direction) {
    if (!canUpload || busy) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedPhotos.length) return;

    const previous = orderedPhotos;
    const next = [...orderedPhotos];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setOrderedPhotos(next);
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/account/ads/${encodeURIComponent(adId)}/photos/order`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoIds: next.map((photo) => photo.id) }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Не удалось изменить порядок.");
      }
      router.refresh();
    } catch (err) {
      setOrderedPhotos(previous);
      setError(err.message || "Не удалось изменить порядок.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId) {
    if (!canUpload || busy) return;
    if (!window.confirm("Удалить эту фотографию из объявления?")) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/account/ads/${encodeURIComponent(adId)}/photos/${encodeURIComponent(photoId)}`,
        { method: "DELETE", credentials: "same-origin" }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Не удалось удалить фотографию.");
      }
      setOrderedPhotos((current) => current.filter((photo) => photo.id !== photoId));
      if (result.storageCleanupPending) {
        setNotice("Фотография удалена из объявления. Очистку S3 нужно проверить в журнале сервера.");
      }
      router.refresh();
    } catch (err) {
      setError(err.message || "Ошибка удаления.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.photoEditor} aria-label="Фотографии объявления">
      <h2>Фотографии ({orderedPhotos.length}/8)</h2>
      <div className={styles.photoGrid}>
        {orderedPhotos.map((photo, index) => (
          <div className={styles.photoTile} key={photo.id}>
            <Image
              src={`/api/account/ads/${encodeURIComponent(adId)}/photos/${encodeURIComponent(photo.id)}?size=320`}
              alt={`Фотография ${index + 1}`}
              width={160}
              height={120}
              unoptimized
            />
            {index === 0 && <span className={styles.photoCover}>Обложка</span>}
            {canUpload && (
              <div className={styles.photoActions}>
                <button type="button" onClick={() => move(index, -1)}
                  disabled={busy || index === 0}
                  aria-label={`Передвинуть фото ${index + 1} влево`}
                  title="Передвинуть влево">←</button>
                <button type="button" onClick={() => move(index, 1)}
                  disabled={busy || index === orderedPhotos.length - 1}
                  aria-label={`Передвинуть фото ${index + 1} вправо`}
                  title="Передвинуть вправо">→</button>
                <button type="button" onClick={() => remove(photo.id)}
                  disabled={busy}
                  aria-label={`Удалить фото ${index + 1}`}
                  title="Удалить фотографию">Удалить</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {canUpload && orderedPhotos.length < 8 && (
        <label className={styles.photoInputLabel}>
          {busy ? "Обрабатываем..." : "Добавить фотографию"}
          <input ref={inputRef} type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload} disabled={busy} />
        </label>
      )}
      <p className={styles.notice}>
        До 8 фотографий, JPEG/PNG/WebP, не более 5 МБ каждая.
        Первая фотография будет обложкой объявления после публикации.
      </p>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
