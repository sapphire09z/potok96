"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Image from "@tiptap/extension-image";
import styles from "./rich-text-editor.module.css";

function Tool({ label, title, active = false, disabled, onClick }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

// Markdown is the canonical source stored in NewsPost.body. This editor never
// saves by itself and must not rewrite an existing draft just by opening it.
export default function NewsRichTextEditor({ value, onChange, editorRef }) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const [, rerender] = useState(0);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                link: { openOnClick: false, autolink: false },
            }),
            Markdown,
            Image,
        ],
        content: value || "",
        contentType: "markdown",
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: styles.editable,
                role: "textbox",
                "aria-label": "Текст новости",
                "aria-multiline": "true",
                spellcheck: "true",
            },
        },
        onUpdate({ editor: current }) {
            onChangeRef.current(current.getMarkdown());
        },
        onSelectionUpdate() {
            rerender((value) => value + 1);
        },
    });

    useEffect(() => {
        if (!editorRef) return;
        editorRef.current = editor;
        return () => {
            if (editorRef.current === editor) editorRef.current = null;
        };
    }, [editor, editorRef]);

    function editLink() {
        if (!editor) return;
        const existing = editor.getAttributes("link").href || "";
        const input = window.prompt("Ссылка (https://…), пустое значение удалит ссылку:", existing);
        if (input === null) return;
        const href = input.trim();
        if (!href) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        try {
            const url = new URL(href);
            if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
                throw new Error("invalid link");
            }
        } catch {
            window.alert("Нужна полная ссылка с http:// или https://.");
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }

    if (!editor) {
        return <p className={styles.loading}>Загружаем визуальный редактор…</p>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.toolbar} role="toolbar" aria-label="Форматирование новости">
                <Tool label="B" title="Жирный (Cmd/Ctrl+B)" active={editor.isActive("bold")}
                    onClick={() => editor.chain().focus().toggleBold().run()} />
                <Tool label="I" title="Курсив (Cmd/Ctrl+I)" active={editor.isActive("italic")}
                    onClick={() => editor.chain().focus().toggleItalic().run()} />
                <Tool label="S" title="Зачёркнутый" active={editor.isActive("strike")}
                    onClick={() => editor.chain().focus().toggleStrike().run()} />
                <span className={styles.separator} aria-hidden="true" />
                <Tool label="Текст" title="Обычный абзац" active={editor.isActive("paragraph")}
                    onClick={() => editor.chain().focus().setParagraph().run()} />
                <Tool label="H2" title="Подзаголовок второго уровня" active={editor.isActive("heading", { level: 2 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
                <Tool label="H3" title="Подзаголовок третьего уровня" active={editor.isActive("heading", { level: 3 })}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
                <span className={styles.separator} aria-hidden="true" />
                <Tool label="• Список" title="Маркированный список" active={editor.isActive("bulletList")}
                    onClick={() => editor.chain().focus().toggleBulletList().run()} />
                <Tool label="1. Список" title="Нумерованный список" active={editor.isActive("orderedList")}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                <Tool label="❝" title="Цитата" active={editor.isActive("blockquote")}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()} />
                <Tool label="Ссылка" title="Добавить или изменить ссылку" active={editor.isActive("link")}
                    onClick={editLink} />
                <span className={styles.separator} aria-hidden="true" />
                <Tool label="↶" title="Отменить (Cmd/Ctrl+Z)"
                    disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
                <Tool label="↷" title="Повторить (Cmd/Ctrl+Shift+Z)"
                    disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
            </div>
            <EditorContent editor={editor} className={styles.surface} />
            <p className={styles.hint}>Выдели текст и выбери оформление. Фотография из галереи вставляется на место курсора.</p>
        </div>
    );
}
