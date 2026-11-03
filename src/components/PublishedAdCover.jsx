import Image from "next/image";

// Native <picture> uses pre-generated CDN sizes, bypassing Next.js image reprocessing.
export default function PublishedAdCover({ ad, className }) {
  const source = ad.photoVariants?.[0];
  if (!source) {
    return (
      <Image
        src={ad.photos[0]}
        alt={`Фото объявления: ${ad.title}`}
        fill
        sizes="(max-width: 759px) 100vw, 550px"
        className={className}
      />
    );
  }
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${source.src320} 320w, ${source.src640} 640w, ${source.src960} 960w`}
        sizes="(max-width: 759px) 100vw, 550px"
      />
      <Image
        src={source.src640}
        alt={`Фото объявления: ${ad.title}`}
        fill
        unoptimized
        sizes="(max-width: 759px) 100vw, 550px"
        className={className}
      />
    </picture>
  );
}
