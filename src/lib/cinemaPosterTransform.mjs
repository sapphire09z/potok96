import sharp from "sharp";

// Shared image handling for manual and scheduled poster imports.
export async function convertCinemaPoster(bytes) {
    const info = await sharp(bytes, { limitInputPixels: 25_000_000, failOn: "error" }).metadata();
    if (!["jpeg", "png"].includes(info.format) || !info.width || !info.height ||
        info.width * info.height > 25_000_000 || (info.pages ?? 1) > 1) {
        throw new Error("Unsupported or oversized source image.");
    }
    return sharp(bytes, { limitInputPixels: 25_000_000, failOn: "error" })
        .rotate().resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 }).toBuffer();
}
