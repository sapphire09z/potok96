"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import NewsImageManager from "./NewsImageManager";
import NewsRichTextEditor from "./NewsRichTextEditor";
import NewsAiAssistant from "./NewsAiAssistant";
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

const AUTO_SAVE_IDLE_MS = 2000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The server remains the source of truth. Invalid intermediate input should
// stay in the tab backup, not trigger an endless series of rejected requests.
function validForAutosave(draft) {
    const tags = draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!draft.title.trim() || draft.title.trim().length > 180 ||
        !SLUG.test(draft.slug) || draft.slug.length > 160 ||
        !draft.category.trim() || draft.category.trim().length > 48 ||
        draft.summary.length > 600 || draft.body.length > 30000 ||
        draft.authorName.length > 120 || draft.sourceName.length > 180 ||
        draft.sourceText.length > 20000 || draft.rightsNote.length > 2000 ||
        draft.cover.length > 512 || tags.length > 12 ||
        tags.some((tag) => tag.length > 40)) return false;
    if (draft.sourceUrl) {
        try {
            const url = new URL(draft.sourceUrl);
            if (url.protocol !== "https:" || url.username || url.password) return false;
        } catch { return false; }
    }
    return true;
}

function payloadFrom(draft) {
    const { id, status, images, coverImageId, ...fields } = draft;
    return { ...fields, tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) };
}

export default function NewsDraftForm({ initialPost, storageScope }) {
    const router = useRouter();
    const [form, setForm] = useState(() => ({
        ...blank,
        ...initialPost,
        ...Object.fromEntries(
            Object.keys(blank)
                .filter((key) => key !== "tags")
                .map((key) => [key, initialPost?.[key] ?? blank[key]])
        ),
        tags: (initialPost?.tags ?? []).join(", "),
    }));
    const [mode, setMode] = useState("edit");
    // Unsupported Markdown constructs remain editable through the source view.
    const [formatMode, setFormatMode] = useState(() =>
        /(?:^|\n)\s*\|[^\n]*\|\s*\n|<!--|<\/?[a-z][^>]*>/i.test(initialPost?.body ?? "")
            ? "markdown"
            : "visual"
    );
    const richEditorRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState("");
    const [revision, setRevision] = useState(0);
    const [savedRevision, setSavedRevision] = useState(0);
    const [recovery, setRecovery] = useState(null);
    const [editorEpoch, setEditorEpoch] = useState(0);
    const [recoveryReady, setRecoveryReady] = useState(false);
    const [backupFailed, setBackupFailed] = useState(false);
    const inFlight = useRef(false);
    const blockedRevision = useRef(-1);
    const latestForm = useRef(form);
    const latestRevision = useRef(revision);
    latestForm.current = form;
    latestRevision.current = revision;
    const dirty = revision > savedRevision;
    const backupKey = `potok96:news-draft:v1:${storageScope}:${initialPost?.id ?? "new"}`;
    const [images, setImages] = useState(initialPost?.images ?? []);
    const [coverImageId, setCoverImageId] = useState(initialPost?.coverImageId ?? null);
    const tagsForPreview = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const coverImage = images.find((item) => item.id === coverImageId);
    const verifiedSourceUrl = /^https:\/\/[^\s@]+$/i.test(form.sourceUrl.trim()) ? form.sourceUrl.trim() : "";
    const complexMarkdown = /(?:^|\n)\s*\|[^\n]*\|\s*\n|<!--|<\/?[a-z][^>]*>/i.test(form.body);

    // Keep a tab-scoped recovery copy. Do not silently restore stale text
    // over a newer server version: the editor must explicitly choose it.
    useEffect(() => {
        try {
            const raw = window.sessionStorage.getItem(backupKey);
            const backup = raw ? JSON.parse(raw) : null;
            if (backup?.version === 1 && backup.form &&
                typeof backup.form === "object" &&
                Object.keys(blank).some((key) =>
                    (backup.form[key] ?? "") !== (latestForm.current[key] ?? ""))) {
                setRecovery(backup.form);
            } else {
                window.sessionStorage.removeItem(backupKey);
            }
        } catch {
            setBackupFailed(true);
        }
        setRecoveryReady(true);
    }, [backupKey]);

    useEffect(() => {
        if (!recoveryReady || recovery) return;
        try {
            if (dirty) {
                const fields = Object.fromEntries(
                    Object.keys(blank).map((key) => [key, form[key]])
                );
                window.sessionStorage.setItem(backupKey,
                    JSON.stringify({ version: 1, form: fields, savedAt: Date.now() }));
            } else {
                window.sessionStorage.removeItem(backupKey);
            }
            setBackupFailed(false);
        } catch {
            setBackupFailed(true);
        }
    }, [backupKey, form, dirty, recovery, recoveryReady]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    function resolveRecovery(restore) {
        if (restore && recovery) {
            const restored = Object.fromEntries(
                Object.keys(blank).filter((key) => typeof recovery[key] === "string")
                    .map((key) => [key, recovery[key]])
            );
            setForm((previous) => ({ ...previous, ...restored }));
            // Tiptap reads its initial Markdown only when mounted.
            setEditorEpoch((value) => value + 1);
            if (/(?:^|\n)\s*\|[^\n]*\|\s*\n|<!--|<\/?[a-z][^>]*>/i.test(restored.body ?? "")) {
                setFormatMode("markdown");
            }
            setRevision((value) => value + 1);
            setSaved("");
            setError("");
        } else {
            try { window.sessionStorage.removeItem(backupKey); }
            catch { setBackupFailed(true); }
        }
        setRecovery(null);
    }

    function insertImage(item) {
        if (!initialPost) return;
        const caption = (item.caption || "Фотография").replace(/[\[\]\n"\\]/g, " ");
        const address = `/api/editor/news/${initialPost.id}/images/${item.id}?size=960`;
        const title = item.caption ? ` "${caption}"` : "";
        const editor = formatMode === "visual" ? richEditorRef.current : null;
        if (editor) {
            editor.chain().focus().setImage({ src: address, alt: caption, title: item.caption || null }).run();
            change("body", editor.getMarkdown());
        } else {
            change("body", `${form.body.trimEnd()}\n\n![${caption}](${address}${title})\n`);
        }
        setMode("edit");
    }


    function applyAiEdits(replacements) {
        const allowed = Object.fromEntries(Object.entries(replacements).filter(
            ([key, value]) => ["title", "summary", "body"].includes(key) && typeof value === "string"));
        if (Object.keys(allowed).length === 0) return;
        setForm((previous) => ({ ...previous, ...allowed }));
        // Tiptap reads its initial Markdown on mount; remount after a chosen replacement.
        if (Object.prototype.hasOwnProperty.call(allowed, "body")) setEditorEpoch((value) => value + 1);
        setRevision((value) => value + 1);
        setSaved("");
        setError("");
    }

    function change(name, value) {
        setForm((previous) => ({ ...previous, [name]: value }));
        setError("");
        setSaved("");
        setRevision((value) => value + 1);
    }

    async function persist(auto = false) {
        if (inFlight.current || !recoveryReady || recovery) return;
        if (auto && (!initialPost || !validForAutosave(latestForm.current) ||
            blockedRevision.current === latestRevision.current)) return;

        const capturedRevision = latestRevision.current;
        const capturedForm = latestForm.current;
        inFlight.current = true;
        setBusy(true);
        setError("");
        setSaved(auto ? "Автосохранение…" : "Сохраняем…");

        try {
            const url = initialPost
                ? `/api/editor/news/${encodeURIComponent(initialPost.id)}`
                : "/api/editor/news";
            const response = await fetch(url, {
                method: initialPost ? "PATCH" : "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payloadFrom(capturedForm)),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Сохранение не удалось.");

            if (!initialPost) {
                // If typing continued during creation, carry the newer copy
                // to the new draft's recovery key before navigating.
                const nextKey = `potok96:news-draft:v1:${storageScope}:${result.id}`;
                try {
                    if (latestRevision.current !== capturedRevision) {
                        window.sessionStorage.setItem(nextKey, JSON.stringify({
                            version: 1, savedAt: Date.now(),
                            form: Object.fromEntries(Object.keys(blank).map(
                                (key) => [key, latestForm.current[key]])),
                        }));
                    }
                    window.sessionStorage.removeItem(backupKey);
                } catch {
                    setBackupFailed(true);
                }
                router.replace(`/editor/news/${encodeURIComponent(result.id)}`);
                router.refresh();
            } else {
                setSavedRevision((value) => Math.max(value, capturedRevision));
                const time = new Date().toLocaleTimeString("ru-RU", {
                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                });
                setSaved(latestRevision.current === capturedRevision
                    ? `Сохранено в ${time}` : "Сохраняем новые изменения…");
            }
        } catch (err) {
            blockedRevision.current = capturedRevision;
            setError(err.message || "Не удалось сохранить изменения.");
            setSaved("Сохранение не удалось. Изменения остались в этой вкладке.");
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    const persistRef = useRef(persist);
    persistRef.current = persist;
    useEffect(() => {
        if (!initialPost || !recoveryReady || recovery || !dirty || busy ||
            blockedRevision.current === revision || !validForAutosave(form)) return;
        const timer = window.setTimeout(() => persistRef.current(true), AUTO_SAVE_IDLE_MS);
        return () => window.clearTimeout(timer);
    }, [form, revision, savedRevision, initialPost, recoveryReady, recovery, dirty, busy]);

    function save(event) {
        event.preventDefault();
        void persist(false);
    }

    return (
        <div className={styles.page}>
            <nav className={styles.back}>
                <Link href="/editor/news" onClick={(event) => {
                    if (dirty && !window.confirm("Есть несохранённые изменения. Покинуть редактор?")) {
                        event.preventDefault();
                    }
                }}>← Управление новостями</Link>
            </nav>
            <div className={styles.heading}>
                <div>
                    <p className={styles.kicker}>Поток 96 / Редакция</p>
                    <h1>{initialPost ? "Редактирование новости" : "Новая новость"}</h1>
                    <p>Черновик не публикуется. {initialPost
                        ? "Изменения автоматически сохраняются через 2 секунды после ввода."
                        : "Первое сохранение — кнопкой ниже. Затем включится автосохранение."}</p>
                </div>
                <div className={styles.headingActions}>
                    {initialPost && <Link className={styles.reviewLink} href={`/editor/news/${initialPost.id}/review`}
                        onClick={(event) => {
                            if (dirty || busy || recovery) {
                                event.preventDefault();
                                setError("Сначала дождитесь сохранения всех изменений.");
                            }
                        }}>Проверка и история</Link>}
                    <span className={styles.status}>Черновик</span>
                </div>
            </div>

            <div className={styles.tabs} role="group" aria-label="Режим редактора">
                <button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>Редактирование</button>
                <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>Предпросмотр</button>
            </div>

            {recovery && <section className={styles.recovery} role="alert">
                <strong>Найдена несохранённая копия в этой вкладке</strong>
                <p>Можно восстановить изменения после обновления страницы. Серверный черновик не заменяется без подтверждения.</p>
                <div>
                    <button type="button" onClick={() => resolveRecovery(true)}>Восстановить</button>
                    <button type="button" onClick={() => resolveRecovery(false)}>Оставить серверную версию</button>
                </div>
            </section>}
            {backupFailed && <p className={styles.error} role="alert">
                Браузер не смог записать резервную копию во вкладке. Сохраняйте текст на сервер чаще.
            </p>}
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
                        <section className={styles.editorField} aria-label="Текст новости">
                            <div className={styles.editorModeHeading}>
                                <strong>Текст новости</strong>
                                <div className={styles.editorModeActions} role="group" aria-label="Способ редактирования текста">
                                    <button type="button" aria-pressed={formatMode === "visual"}
                                        disabled={complexMarkdown} title={complexMarkdown ? "Сложная разметка редактируется только в Markdown" : undefined}
                                        onClick={() => setFormatMode("visual")}>Визуально</button>
                                    <button type="button" aria-pressed={formatMode === "markdown"}
                                        onClick={() => setFormatMode("markdown")}>Markdown</button>
                                </div>
                            </div>
                            {formatMode === "visual" ? (
                                <NewsRichTextEditor
                                    key={editorEpoch}
                                    value={form.body}
                                    onChange={(value) => change("body", value)}
                                    editorRef={richEditorRef}
                                />
                            ) : (
                                <>
                                    <textarea rows={16} maxLength={30000} value={form.body}
                                        onChange={(event) => change("body", event.target.value)}
                                        aria-label="Исходный Markdown статьи" placeholder="Основной текст новости…" />
                                    <p className={styles.hint}>Режим Markdown сохраняет исходную разметку. Используй его для сложных блоков или проверки текста.</p>
                                </>
                            )}
                            {complexMarkdown && <p className={styles.hint} role="status">Обнаружена таблица, HTML или специальная разметка. Для сохранения её без изменений используй режим Markdown.</p>}
                            <p className={styles.hint}>После первого сохранения изменения записываются автоматически при паузе в наборе. Фотографии можно вставлять из галереи ниже.</p>
                        </section>
                        <NewsAiAssistant draft={{ title: form.title, summary: form.summary, body: form.body }}
                            disabled={busy || Boolean(recovery) || !recoveryReady}
                            onApply={applyAiEdits} />
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
                    <button type="submit" disabled={busy || Boolean(recovery)} className={styles.primary}>
                        {busy ? "Сохраняем…" : "Сохранить сейчас"}
                    </button>
                    {dirty && !busy && <span className={styles.unsaved} role="status">
                        {initialPost && !validForAutosave(form)
                            ? "Есть несохранённые изменения — проверьте обязательные поля."
                            : "Есть несохранённые изменения"}
                    </span>}
                    {saved && <span role="status" className={error ? styles.error : styles.saved}>{saved}</span>}
                    {error && <span role="alert" className={styles.error}>{error}</span>}
                </div>
            </form>
        </div>
    );
}
