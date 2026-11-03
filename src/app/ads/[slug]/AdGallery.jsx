"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./ad.module.css";

export default function AdGallery({ photos, title, photoVariants = [] }) {
  const [selected, setSelected] = useState(0);
  if (!photos?.length) return null;

  const current = photos[selected] ?? photos[0];
  const variant = photoVariants[selected];

  return (
    <section className={styles.gallery} aria-label="Фотографии объявления">
      <a
        href={variant?.src1440 ?? current}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.galleryMain}
        aria-label="Открыть фотографию в полном размере"
      >
        <picture>
          {variant && (
            <source
              type="image/webp"
              srcSet={`${variant.src640} 640w, ${variant.src960} 960w, ${variant.src1440} 1440w`}
              sizes="(max-width: 700px) 100vw, 760px"
            />
          )}
          <Image
            src={current}
            alt={`${title}, фото ${selected + 1}`}
            fill
            priority={selected === 0}
            sizes="(max-width: 700px) 100vw, 760px"
            className={styles.galleryImage}
            unoptimized={Boolean(variant)}
          />
        </picture>
      </a>

      {photos.length > 1 && (
        <div className={styles.thumbnails}>
          {photos.map((photo, index) => (
            <button
              key={photo}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Показать фото ${index + 1}`}
              aria-pressed={selected === index}
              className={`${styles.thumbnail} ${selected === index ? styles.thumbnailActive : ""}`}
            >
              <Image
                src={photoVariants[index]?.src320 ?? photo}
                alt=""
                fill
                sizes="80px"
                className={styles.thumbnailImage}
                unoptimized={Boolean(photoVariants[index])}
              />
            </button>
          ))}
        </div>
      )}
      <div className={styles.galleryCounter}>Фото {selected + 1} из {photos.length}</div>
    </section>
  );
}
