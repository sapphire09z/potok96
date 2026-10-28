
"use client";

import { useState } from "react";
import Image from "next/image";

import styles from "./ad.module.css";

export default function AdGallery({ photos, title }) {
    const [selected, setSelected] = useState(0);

    if (!photos?.length) return null;

    const currentPhoto = photos[selected] ?? photos[0];

    return (
        <section
            className={styles.gallery}
            aria-label="Фотографии объявления"
        >
            <a
                href={currentPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.galleryMain}
                aria-label="Открыть фотографию в полном размере"
            >
                <Image
                    src={currentPhoto}
                    alt={`${title}, фото ${selected + 1}`}
                    fill
                    priority
                    sizes="(max-width: 700px) 100vw, 760px"
                    className={styles.galleryImage}
                />
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
                            className={`${styles.thumbnail} ${
                                selected === index
                                    ? styles.thumbnailActive
                                    : ""
                            }`}
                        >
                            <Image
                                src={photo}
                                alt=""
                                fill
                                sizes="80px"
                                className={styles.thumbnailImage}
                            />
                        </button>
                    ))}
                </div>
            )}

            <div className={styles.galleryCounter}>
                Фото {selected + 1} из {photos.length}
            </div>
        </section>
    );
}
