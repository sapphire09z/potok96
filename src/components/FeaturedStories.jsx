
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { formatDate } from "@/lib/date";

import styles from "./FeaturedStories.module.css";

export default function FeaturedStories({ stories = [] }) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: false,
        align: "start",
        breakpoints: {
            "(prefers-reduced-motion: reduce)": {
                duration: 0,
            },
        },
    });

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [canPrev, setCanPrev] = useState(false);
    const [canNext, setCanNext] = useState(false);

    const onSelect = useCallback((api) => {
        setSelectedIndex(api.selectedScrollSnap());
        setCanPrev(api.canScrollPrev());
        setCanNext(api.canScrollNext());
    }, []);

    useEffect(() => {
        if (!emblaApi) return;

        onSelect(emblaApi);
        emblaApi.on("select", onSelect);
        emblaApi.on("reInit", onSelect);

        return () => {
            emblaApi.off("select", onSelect);
            emblaApi.off("reInit", onSelect);
        };
    }, [emblaApi, onSelect]);

    if (!stories.length) return null;

    const multiple = stories.length > 1;

    return (
        <div
            className={styles.carousel}
            role="region"
            aria-roledescription="карусель"
            aria-label="Главные новости"
        >
            <div className={styles.viewport} ref={emblaRef}>
                <div className={styles.container}>
                    {stories.map((post, index) => (
                        <div
                            className={styles.slide}
                            key={post.slug}
                            role="group"
                            aria-roledescription="слайд"
                            aria-label={`${index + 1} из ${stories.length}`}
                            inert={multiple && selectedIndex !== index}
                        >
                            <Link
                                href={`/news/${post.slug}`}
                                className={styles.story}
                            >
                                {post.cover && (
                                    <div className={styles.image}>
                                        <Image
                                            src={post.cover}
                                            alt={post.title}
                                            fill
                                            priority={index === 0}
                                            sizes="(max-width: 700px) 100vw, 760px"
                                            className={styles.cover}
                                            draggable={false}
                                        />
                                    </div>
                                )}

                                <h2 className={styles.title}>{post.title}</h2>

                                {post.summary && (
                                    <p className={styles.summary}>{post.summary}</p>
                                )}

                                <div className={styles.meta}>
                                    <span>{post.category}</span>
                                    <span>·</span>
                                    <span>{formatDate(post.date)}</span>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            {multiple && (
                <div className={styles.controls}>
                    <div className={styles.dots}>
                        {stories.map((post, index) => (
                            <button
                                key={post.slug}
                                type="button"
                                className={`${styles.dot} ${
                                    index === selectedIndex ? styles.activeDot : ""
                                }`}
                                aria-label={`Показать новость ${index + 1}: ${post.title}`}
                                aria-current={index === selectedIndex ? "true" : undefined}
                                onClick={() => emblaApi?.scrollTo(index)}
                            />
                        ))}
                    </div>

                    <div className={styles.navigation}>
            <span className={styles.counter} aria-live="polite">
              {selectedIndex + 1} / {stories.length}
            </span>

                        <button
                            type="button"
                            className={styles.arrow}
                            onClick={() => emblaApi?.scrollPrev()}
                            disabled={!canPrev}
                            aria-label="Предыдущая новость"
                        >
                            ←
                        </button>

                        <button
                            type="button"
                            className={styles.arrow}
                            onClick={() => emblaApi?.scrollNext()}
                            disabled={!canNext}
                            aria-label="Следующая новость"
                        >
                            →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
