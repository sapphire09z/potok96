
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const MOVIES_DIR = path.join(process.cwd(), "content", "movies");

function safeTicketUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return "";
    }

    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : "";
    } catch {
        return "";
    }
}

export async function getAllMovies() {
    let files;

    try {
        files = await fs.readdir(MOVIES_DIR);
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }

    const movies = await Promise.all(
        files
            .filter((file) => file.endsWith(".md"))
            .map(async (filename) => {
                const raw = await fs.readFile(
                    path.join(MOVIES_DIR, filename),
                    "utf8"
                );

                const { data } = matter(raw);

                const screenings = Array.isArray(data.screenings)
                    ? data.screenings
                        .filter((item) =>
                            item &&
                            typeof item.startAt === "string" &&
                            Number.isFinite(
                                Date.parse(item.startAt)
                            )
                        )
                        .map((item) => ({
                            startAt: item.startAt,
                            price:
                                Number.isFinite(Number(item.price)) &&
                                item.price !== "" &&
                                item.price != null
                                    ? Number(item.price)
                                    : null,
                            pushkinCard:
                                item.pushkinCard === true,
                            ticketUrl:
                                safeTicketUrl(item.ticketUrl),
                        }))
                    : [];

                return {
                    slug: path.basename(filename, ".md"),
                    title: String(data.title ?? ""),
                    genre: String(data.genre ?? ""),
                    durationMinutes:
                        Number(data.durationMinutes) || null,
                    ageRating: String(data.ageRating ?? ""),
                    summary: String(data.summary ?? ""),
                    poster:
                        typeof data.poster === "string" &&
                        data.poster.startsWith("/media/movies/") &&
                        !data.poster.includes("..")
                            ? data.poster
                            : "",
                    status: data.status ?? "draft",
                    screenings,
                };
            })
    );

    return movies.filter(
        (movie) =>
            movie.status === "published" &&
            movie.title
    );
}
