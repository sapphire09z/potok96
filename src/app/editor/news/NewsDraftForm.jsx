"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import NewsImageManager from "./NewsImageManager";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import styles from "./draft-form.module.css";

const CYRILLIC = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function makeSlug(text) {
    return text.toLowerCase().split("").map((char) => CYRILLIC[char] ?? char)
        .join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160).replace(/-$/, "");
}

function PreviewParagraph({ node, children, ...props }) {
    const elements = node?.children?.filter((child) => child.type !== "text" || child.value.trim() !== "") ?? [];
    const image = elements.length === 1 && elements[0].type === "element" && elements[0].tagName === "img"
        ? elements[0] : null;
    if (image) return <figure className={styles.figure}>
        {children}
        {image.properties?.title && <figcaption>{image.properties.title}</figcaption>}
    </figure>;
    return <p {...props}>{children}</p>;
}

const blank = {
    title: "", slug: "", summary: "", body: "", category: "город",
    authorName: "Редакция Поток 96", tags: [], cover: "",
    sourceName: "", sourceUrl: "", sourceText: "", sourceKind: "OWN", rightsNote: "",
};

export default function NewsDraftForm({ initialPost }) {
    const router = useRouter();
    const [form, setForm] = useState(() => ({ ...blank, ...initialPost, tags: (initialPost?.tags ?? []).join(", ") }));
    const [mode, setMode] = useState("edit");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState("");
    const [dirty, setDirty] = useState(false);
    const [images, setImages] = useState(initialPost?.images ?? []);
    const [coverImageId, setCoverImageId] = useState(initialPost?.coverImageId ?? null);
    const tagsForPreview = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const coverImage = images.find((item) => item.id === coverImageId);
    const verifiedSourceUrl = /^https:\/\/[^\s@]+$/i.test(form.sourceUrl.trim()) ? form.sourceUrl.trim() : "";

    function insertImage(item) {
        if (!initialPost) return;
        const caption = (item.caption || "Фотография").replace(/[\[\]\n"\\]/g, " ");
        const address = `/api/editor/news/${initialPost.id}/images/${item.id}?size=960`;
        const title = item.caption ? ` "${caption}"` : "";
        change("body", `${form.body.trimEnd()}\n\n![${caption}](${address}${title})\n`);
        setMode("edit");
    }


    function change(name, value) {
        setForm((previous) => ({ ...previous, [name]: value }));
        setError("");
        setSaved("");
        setDirty(true);
    }

    async function save(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setSaved("");

        const payload = {
            ...form,
            tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        };
        delete payload.id;
        delete payload.status;
        delete payload.images;
        delete payload.coverImageId;

        try {
            const url = initialPost ? `/api/editor/news/${encodeURIComponent(initialPost.id)}` : "/api/editor/news";
            const response = await fetch(url, {
                method: initialPost ? "PATCH" : "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Сохранение не удалось.");
            setDirty(false);
            if (!initialPost) {
                router.replace(`/editor/news/${encodeURIComponent(result.id)}`);
                router.refresh();
            } else {
                setSaved("Черновик сохранён.");
                router.refresh();
            }
        } catch (err) {
            setError(err.message || "Не удалось сохранить черновик.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={styles.page}>
            <nav className={styles.back}>
                <Link href="/editor/news">← Управление новостями</Link>
            </nav>
            <div className={styles.heading}>
                <div>
                    <p className={styles.kicker}>Поток 96 / Редакция</p>
                    <h1>{initialPost ? "Редактирование новости" : "Новая новость"}</h1>
                    <p>Сохраняется только черновик. Публичная новостная лента не меняется.</p>
                </div>
                <span className={styles.status}>Черновик</span>
            </div>

            <div className={styles.tabs} role="group" aria-label="Режим редактора">
                <button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>Редактирование</button>
                <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>Предпросмотр</button>
            </div>

            <form onSubmit={save}>
                {mode === "edit" ? (
                    <div className={styles.fields}>
                        <label>Заголовок *
                            <input required maxLength={180} value={form.title} onChange={(e) => change("title", e.target.value)} />
                        </label>
                        <label>Адрес новости (латиница через дефис) *
                            <div className={styles.slugRow}>
                                <input required minLength={3} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(e) => change("slug", e.target.value)} placeholder="primer-novosti" />
                                <button type="button" onClick={() => change("slug", makeSlug(form.title))}>Из заголовка</button>
                            </div>
                        </label>
                        <label>Рубрика *
                            <input required maxLength={48} value={form.category} onChange={(e) => change("category", e.target.value)} />
                        </label>
                        <label>Краткий анонс
                            <textarea rows={3} maxLength={600} value={form.summary} onChange={(e) => change("summary", e.target.value)} />
                        </label>
                        <label>Текст новости (Markdown)
                            <textarea rows={16} maxLength={30000} value={form.body} onChange={(e) => change("body", e.target.value)} placeholder="Основной текст новости…" />
                        </label>
                        <label>Автор
                            <input maxLength={120} value={form.authorName} onChange={(e) => change("authorName", e.target.value)} />
                        </label>
                        <label>Теги через запятую
                            <input value={form.tags} onChange={(e) => change("tags", e.target.value)} placeholder="город, культура" />
                        </label>
                        <NewsImageManager
                            postId={initialPost?.id}
                            images={images}
                            coverImageId={coverImageId}
                            onImages={setImages}
                            onCover={setCoverImageId}
                            onInsert={insertImage}
                            body={form.body}
                        />
                        <details className={styles.source} open>
                            <summary>Происхождение материала и права использования</summary>
                            <p className={styles.hint}>Название и ссылка на источник появятся в публичной статье после подключения CMS к новостной ленте (этап 5.3). Исходный текст и сведения о разрешениях останутся внутри редакции. Правомерность использования проверим перед публикацией.</p>
                            <label>Тип материала
                                <select value={form.sourceKind} onChange={(e) => change("sourceKind", e.target.value)}>
                                    <option value="OWN">Собственный материал редакции</option>
                                    <option value="OFFICIAL">Официальная информация</option>
                                    <option value="PRESS_RELEASE">Пресс-релиз</option>
                                    <option value="THIRD_PARTY">Материал другого СМИ/автора</option>
                                    <option value="OTHER">Другое</option>
                                </select>
                            </label>
                            <label>Наименование источника
                                <input maxLength={180} value={form.sourceName} onChange={(e) => change("sourceName", e.target.value)} />
                            </label>
                            <label>Ссылка на источник (HTTPS)
                                <input type="url" maxLength={2048} value={form.sourceUrl} onChange={(e) => change("sourceUrl", e.target.value)} placeholder="https://example.ru/news" />
                            </label>
                            <label>Исходный текст (внутреннее поле)
                                <textarea rows={8} maxLength={20000} value={form.sourceText} onChange={(e) => change("sourceText", e.target.value)} />
                            </label>
                            <label>Основание использования / разрешение (внутреннее поле)
                                <textarea rows={3} maxLength={2000} value={form.rightsNote} onChange={(e) => change("rightsNote", e.target.value)} placeholder="Собственный материал, разрешение правообладателя, условия цитирования…" />
                            </label>
                        </details>
                    </div>
                ) : (
                    <article className={styles.preview} aria-label="Предпросмотр новости">
                        <p className={styles.kicker}>{form.category || "Без рубрики"}</p>
                        <h2>{form.title || "Без заголовка"}</h2>
                        {form.summary && <p className={styles.summary}>{form.summary}</p>}
                        <p className={styles.previewMeta}>{form.authorName}</p>
                        {coverImage && initialPost ? <Image
                            className={styles.previewCover}
                            src={`/api/editor/news/${initialPost.id}/images/${coverImage.id}?size=960`}
                            alt={coverImage.caption || form.title || "Обложка новости"}
                            width={960} height={540} unoptimized
                        /> : form.cover ? <Image
                            className={styles.previewCover} src={form.cover}
                            alt={form.title || "Обложка новости"} width={960} height={540} unoptimized
                        /> : null}
                        <div className={styles.markdown}><ReactMarkdown components={{ p: PreviewParagraph }}>{form.body || "*Пока нет текста.*"}</ReactMarkdown></div>
                        {tagsForPreview.length > 0 && <div className={styles.tagList}>
                            {tagsForPreview.map((tag, index) => <span key={`${index}-${tag}`}>#{tag}</span>)}
                        </div>}
                        {images.some((item) => item.credit) && <p className={styles.publicSource}>
                            Фото: {images.map((item) => item.credit).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                        </p>}
                        {form.sourceName.trim() && <p className={styles.publicSource}>
                            Источник: {verifiedSourceUrl
                                ? <a href={verifiedSourceUrl} target="_blank" rel="noopener noreferrer">{form.sourceName}</a>
                                : form.sourceName}
                        </p>}
                    </article>
                )}
                <div className={styles.actions}>
                    <button type="submit" disabled={busy} className={styles.primary}>
                        {busy ? "Сохраняем…" : "Сохранить черновик"}
                    </button>
                    {dirty && <span className={styles.unsaved}>Есть несохранённые изменения</span>}
                    {saved && <span role="status" className={styles.saved}>{saved}</span>}
                    {error && <span role="alert" className={styles.error}>{error}</span>}
                </div>
            </form>
        </div>
    );
}
