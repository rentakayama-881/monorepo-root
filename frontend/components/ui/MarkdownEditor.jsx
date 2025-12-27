"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * GitHub-style Markdown Editor
 * 
 * Features:
 * - Full toolbar like GitHub
 * - Write/Preview tabs
 * - Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+E)
 * - Smart text wrapping and line insertion
 * - Proper code block insertion
 */

// Toolbar button
function ToolbarBtn({ onClick, title, children, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active 
          ? "bg-[rgb(var(--brand))] text-white" 
          : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

// Separator
function Sep() {
  return <div className="w-px h-5 bg-[rgb(var(--border))] mx-1" />;
}

// SVG Icons - GitHub style
const I = {
  h1: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.75 2a.75.75 0 01.75.75V7h7V2.75a.75.75 0 011.5 0v10.5a.75.75 0 01-1.5 0V8.5h-7v4.75a.75.75 0 01-1.5 0V2.75A.75.75 0 013.75 2z"/></svg>,
  h2: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.75 2a.75.75 0 01.75.75V7h7V2.75a.75.75 0 011.5 0v10.5a.75.75 0 01-1.5 0V8.5h-7v4.75a.75.75 0 01-1.5 0V2.75A.75.75 0 013.75 2z"/></svg>,
  h3: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3.75 2a.75.75 0 01.75.75V7h7V2.75a.75.75 0 011.5 0v10.5a.75.75 0 01-1.5 0V8.5h-7v4.75a.75.75 0 01-1.5 0V2.75A.75.75 0 013.75 2z"/></svg>,
  bold: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 2a1 1 0 00-1 1v10a1 1 0 001 1h5.5a3.5 3.5 0 001.852-6.47A3.5 3.5 0 008.5 2H4zm4.5 5a1.5 1.5 0 100-3H5v3h3.5zM5 9v3h4.5a1.5 1.5 0 000-3H5z"/></svg>,
  italic: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 2.75A.75.75 0 016.75 2h6.5a.75.75 0 010 1.5h-2.505l-3.858 9H9.25a.75.75 0 010 1.5h-6.5a.75.75 0 010-1.5h2.505l3.858-9H6.75A.75.75 0 016 2.75z"/></svg>,
  strike: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a.75.75 0 01.75.75v.5h4.5a.75.75 0 010 1.5H8.75v1H11a3 3 0 013 3v.25a3 3 0 01-3 3H8.75v3.25a.75.75 0 01-1.5 0V11H5a3 3 0 01-3-3v-.25a3 3 0 013-3h2.25v-1h-4.5a.75.75 0 010-1.5h4.5v-.5A.75.75 0 018 1zM5 7.75A1.5 1.5 0 003.5 9.25v.25a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5v-.25a1.5 1.5 0 00-1.5-1.5H5z"/></svg>,
  quote: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M1.75 2.5a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H1.75zm4 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM2.5 7.75a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6z"/></svg>,
  code: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/></svg>,
  link: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.025 5.45a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25z"/></svg>,
  ul: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2 4a1 1 0 100-2 1 1 0 000 2zm3.75-1.5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM3 8a1 1 0 11-2 0 1 1 0 012 0zm-1 6a1 1 0 100-2 1 1 0 000 2z"/></svg>,
  ol: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.003 2.5a.5.5 0 00-.723-.447l-1.003.5a.5.5 0 00.446.895l.28-.14V6H.5a.5.5 0 000 1h2.006a.5.5 0 100-1h-.503V2.5zM5 3.25a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 3.25zm0 5a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 8.25zm0 5a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.75-.75z"/></svg>,
  task: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 8a2 2 0 100-4 2 2 0 000 4z"/><path d="M2 1.75C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v12.5A1.75 1.75 0 0112.25 16h-8.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25h-8.5z"/></svg>,
  img: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h.94l5.077-5.078a1.75 1.75 0 012.412-.06L14.5 10.31V2.75a.25.25 0 00-.25-.25H1.75zm12.5 11H4.81l5.048-5.047a.25.25 0 01.344-.009l4.298 3.889v.917a.25.25 0 01-.25.25zm1.75-11v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75zM5.5 6a.5.5 0 11-1 0 .5.5 0 011 0zM7 6a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  table: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zM1.5 6.5v7.75c0 .138.112.25.25.25H5v-8H1.5zM5 5V1.5H1.75a.25.25 0 00-.25.25V5H5zm1.5 1.5v8h7.75a.25.25 0 00.25-.25V6.5H6.5zm8-1.5V1.75a.25.25 0 00-.25-.25H6.5V5h8z"/></svg>,
  mention: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.475 4.5a.515.515 0 00-.507.611l.92 5.06a.515.515 0 00.507.419H7.76a.515.515 0 00.507-.419l.92-5.06a.515.515 0 00-.507-.611H5.475zm2.93 7.59a5.5 5.5 0 111.97-2.636l-.127.699a.903.903 0 001.772.362l.134-.74A7 7 0 107.5 14.5a7.041 7.041 0 003.401-.879l-.532-1.137a5.508 5.508 0 01-1.964.606z"/></svg>,
};

export default function MarkdownEditor({
  value = "",
  onChange,
  placeholder = "Tulis dengan Markdown...",
  minHeight = "200px",
  disabled = false,
  preview: PreviewComponent,
}) {
  const [tab, setTab] = useState("write");
  const ref = useRef(null);

  // Wrap selected text or insert at cursor
  const wrap = useCallback((before, after = "", defaultText = "") => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const text = selected || defaultText;
    
    const newVal = value.substring(0, start) + before + text + after + value.substring(end);
    onChange(newVal);

    requestAnimationFrame(() => {
      ta.focus();
      if (selected) {
        // If had selection, put cursor after
        const pos = start + before.length + text.length + after.length;
        ta.setSelectionRange(pos, pos);
      } else {
        // Select the placeholder text
        ta.setSelectionRange(start + before.length, start + before.length + text.length);
      }
    });
  }, [value, onChange]);

  // Insert at beginning of current line(s)
  const linePrefix = useCallback((prefix) => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    
    // Find line boundaries
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const actualEnd = lineEnd === -1 ? value.length : lineEnd;
    
    // Get selected lines
    const lines = value.substring(lineStart, actualEnd).split("\n");
    const prefixed = lines.map(l => prefix + l).join("\n");
    
    const newVal = value.substring(0, lineStart) + prefixed + value.substring(actualEnd);
    onChange(newVal);

    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
    });
  }, [value, onChange]);

  // Insert code block
  const codeBlock = useCallback((lang = "") => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    
    // Check if we need newlines
    const needNewlineBefore = start > 0 && value[start - 1] !== "\n";
    const needNewlineAfter = end < value.length && value[end] !== "\n";
    
    const before = (needNewlineBefore ? "\n" : "") + "```" + lang + "\n";
    const after = "\n```" + (needNewlineAfter ? "\n" : "");
    const text = selected || "code";
    
    const newVal = value.substring(0, start) + before + text + after + value.substring(end);
    onChange(newVal);

    requestAnimationFrame(() => {
      ta.focus();
      const codeStart = start + before.length;
      ta.setSelectionRange(codeStart, codeStart + text.length);
    });
  }, [value, onChange]);

  // Insert link/image
  const insertLink = useCallback((isImage = false) => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    
    const prefix = isImage ? "![" : "[";
    const text = selected || (isImage ? "alt text" : "link text");
    const suffix = "](url)";
    
    const newVal = value.substring(0, start) + prefix + text + suffix + value.substring(end);
    onChange(newVal);

    requestAnimationFrame(() => {
      ta.focus();
      // Select "url" part
      const urlStart = start + prefix.length + text.length + 2;
      ta.setSelectionRange(urlStart, urlStart + 3);
    });
  }, [value, onChange]);

  // Insert table
  const insertTable = useCallback(() => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const needNewline = start > 0 && value[start - 1] !== "\n";
    
    const table = (needNewline ? "\n\n" : "") + 
      "| Header 1 | Header 2 | Header 3 |\n" +
      "| -------- | -------- | -------- |\n" +
      "| Cell 1   | Cell 2   | Cell 3   |\n";
    
    const newVal = value.substring(0, start) + table + value.substring(start);
    onChange(newVal);

    requestAnimationFrame(() => {
      ta.focus();
      const selectStart = start + (needNewline ? 2 : 0) + 2;
      ta.setSelectionRange(selectStart, selectStart + 8);
    });
  }, [value, onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;

    const handleKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          wrap("**", "**", "bold");
          break;
        case "i":
          e.preventDefault();
          wrap("_", "_", "italic");
          break;
        case "k":
          e.preventDefault();
          insertLink();
          break;
        case "e":
          e.preventDefault();
          wrap("`", "`", "code");
          break;
        case "`":
          e.preventDefault();
          codeBlock();
          break;
      }
    };

    ta.addEventListener("keydown", handleKey);
    return () => ta.removeEventListener("keydown", handleKey);
  }, [wrap, insertLink, codeBlock]);

  // Toolbar actions
  const actions = [
    { icon: I.h1, title: "Heading 1", fn: () => linePrefix("# ") },
    { icon: I.h2, title: "Heading 2", fn: () => linePrefix("## ") },
    { icon: I.h3, title: "Heading 3", fn: () => linePrefix("### ") },
    "sep",
    { icon: I.bold, title: "Bold (Ctrl+B)", fn: () => wrap("**", "**", "bold") },
    { icon: I.italic, title: "Italic (Ctrl+I)", fn: () => wrap("_", "_", "italic") },
    { icon: I.strike, title: "Strikethrough", fn: () => wrap("~~", "~~", "strikethrough") },
    "sep",
    { icon: I.quote, title: "Quote", fn: () => linePrefix("> ") },
    { icon: I.code, title: "Inline Code (Ctrl+E)", fn: () => wrap("`", "`", "code") },
    { icon: I.code, title: "Code Block (Ctrl+`)", fn: () => codeBlock() },
    { icon: I.link, title: "Link (Ctrl+K)", fn: () => insertLink() },
    "sep",
    { icon: I.ul, title: "Bullet List", fn: () => linePrefix("- ") },
    { icon: I.ol, title: "Numbered List", fn: () => linePrefix("1. ") },
    { icon: I.task, title: "Task List", fn: () => linePrefix("- [ ] ") },
    "sep",
    { icon: I.img, title: "Image", fn: () => insertLink(true) },
    { icon: I.table, title: "Table", fn: () => insertTable() },
  ];

  return (
    <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] overflow-hidden">
      {/* Header with tabs */}
      <div className="flex items-center border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "write"
              ? "border-[rgb(var(--brand))] text-[rgb(var(--fg))]"
              : "border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:border-[rgb(var(--border))]"
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "preview"
              ? "border-[rgb(var(--brand))] text-[rgb(var(--fg))]"
              : "border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:border-[rgb(var(--border))]"
          }`}
        >
          Preview
        </button>
      </div>

      {tab === "write" ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
            {actions.map((a, i) => 
              a === "sep" ? (
                <Sep key={i} />
              ) : (
                <ToolbarBtn 
                  key={i} 
                  onClick={a.fn} 
                  title={a.title} 
                  disabled={disabled}
                >
                  {a.icon}
                </ToolbarBtn>
              )
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-4 py-3 bg-transparent text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus:outline-none resize-y font-mono text-sm leading-relaxed"
            style={{ minHeight }}
          />
        </>
      ) : (
        /* Preview pane */
        <div 
          className="px-4 py-3 overflow-auto"
          style={{ minHeight }}
        >
          {value.trim() ? (
            PreviewComponent ? (
              <PreviewComponent content={value} />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-[rgb(var(--fg))] font-mono">{value}</pre>
            )
          ) : (
            <p className="text-[rgb(var(--muted))] italic text-sm">
              Tidak ada konten untuk di-preview
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
        <p className="text-xs text-[rgb(var(--muted))]">
          Markdown didukung • <kbd className="px-1 py-0.5 text-[10px] bg-[rgb(var(--surface))] rounded border border-[rgb(var(--border))]">Ctrl</kbd>+<kbd className="px-1 py-0.5 text-[10px] bg-[rgb(var(--surface))] rounded border border-[rgb(var(--border))]">B</kbd> bold, <kbd className="px-1 py-0.5 text-[10px] bg-[rgb(var(--surface))] rounded border border-[rgb(var(--border))]">Ctrl</kbd>+<kbd className="px-1 py-0.5 text-[10px] bg-[rgb(var(--surface))] rounded border border-[rgb(var(--border))]">I</kbd> italic
        </p>
        <span className="text-xs text-[rgb(var(--muted))]">
          {value.length} karakter
        </span>
      </div>
    </div>
  );
}
