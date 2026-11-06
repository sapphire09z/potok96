"use client";

import Link from "next/link";
import { useState } from "react";
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

const blank = {
    title: "", slug: "", summary: "", body: "", category: "город",
    authorName: "Редакция Поток 96", tags: [], cover: "",
    sourceName: "", sourceUrl: "", sourceText: "",
};

export default function NewsDraftForm({ initialPost }) {
    const router = useRouter();
    const [form, setForm] = useState(() => ({ ...blank, ...initialPost, tags: (initialPost?.tags ?? []).join(", ") }));
    const [mode, setMode] = useState("edit");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState("");
    const [dirty, setDirty] = useState(false);

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
                        <label>Обложка (путь /media/news/…)
                            <input maxLength={512} value={form.cover} onChange={(e) => change("cover", e.target.value)} placeholder="/media/news/photo.webp" />
                        </label>
                        <fieldset className={styles.source}>
                            <legend>Источник информации — для проверки фактов и ИИ-помощника</legend>
                            <label>Наименование источника
                                <input maxLength={180} value={form.sourceName} onChange={(e) => change("sourceName", e.target.value)} />
                            </label>
                            <label>Ссылка на источник (HTTPS)
                                <input type="url" maxLength={2048} value={form.sourceUrl} onChange={(e) => change("sourceUrl", e.target.value)} placeholder="https://example.ru/news" />
                            </label>
                            <label>Исходный текст
                                <textarea rows={8} maxLength={20000} value={form.sourceText} onChange={(e) => change("sourceText", e.target.value)} />
                            </label>
                        </fieldset>
                    </div>
                ) : (
                    <article className={styles.preview} aria-label="Предпросмотр новости">
                        <p className={styles.kicker}>{form.category || "Без рубрики"}</p>
                        <h2>{form.title || "Без заголовка"}</h2>
                        {form.summary && <p className={styles.summary}>{form.summary}</p>}
                        <p className={styles.previewMeta}>{form.authorName}</p>
                        <div className={styles.markdown}><ReactMarkdown>{form.body || "*Пока нет текста.*"}</ReactMarkdown></div>
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
