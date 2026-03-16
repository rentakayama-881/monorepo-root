"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ToolbarBtn, Sep, I, MarkdownEditorPreview } from "./markdown-editor-utils";

export default function MarkdownEditor({
  value = "",
  onChange,
  placeholder = "Tulis dengan Markdown...",
  minHeight = "200px",
  disabled = false,
  preview: PreviewComponent,
  insertSnippetSignal = null,
  onSnippetInserted,
}) {
  const [tab, setTab] = useState("write");
  const ref = useRef(null);
  const lastSnippetIdRef = useRef("");

  // Wrap selected text or insert at cursor
  const wrap = useCallback(
    (before, after = "", defaultText = "") => {
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
    },
    [value, onChange]
  );

  // Insert at beginning of current line(s)
  const linePrefix = useCallback(
    (prefix) => {
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
      const prefixed = lines.map((l) => prefix + l).join("\n");

      const newVal = value.substring(0, lineStart) + prefixed + value.substring(actualEnd);
      onChange(newVal);

      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
      });
    },
    [value, onChange]
  );

  // Insert code block
  const codeBlock = useCallback(
    (lang = "") => {
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
    },
    [value, onChange]
  );

  // Insert link/image
  const insertLink = useCallback(
    (isImage = false) => {
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
    },
    [value, onChange]
  );

  // Insert table
  const insertTable = useCallback(() => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const needNewline = start > 0 && value[start - 1] !== "\n";

    const table =
      (needNewline ? "\n\n" : "") +
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

  // Track current value in ref to avoid re-running snippet effect on every keystroke
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Insert snippet sent by parent component (for template/preset support)
  useEffect(() => {
    if (!insertSnippetSignal || typeof insertSnippetSignal !== "object") return;

    const snippetId = String(insertSnippetSignal.id || "").trim();
    const snippetText = String(insertSnippetSignal.text || "");
    if (!snippetId || snippetText.length === 0) return;
    if (snippetId === lastSnippetIdRef.current) return;

    lastSnippetIdRef.current = snippetId;

    const currentValue = String(valueRef.current || "");
    const ta = ref.current;
    const start = ta ? ta.selectionStart : currentValue.length;
    const end = ta ? ta.selectionEnd : currentValue.length;
    const nextValue = currentValue.substring(0, start) + snippetText + currentValue.substring(end);
    onChange(nextValue);

    if (typeof onSnippetInserted === "function") {
      onSnippetInserted(snippetId);
    }

    if (ta && !disabled) {
      // Set cursor position for when user next taps the textarea.
      // Do NOT call focus() or scrollIntoView() — on mobile these trigger
      // keyboard open + viewport resize which causes scroll jumps.
      const pos = start + snippetText.length;
      try {
        ta.setSelectionRange(pos, pos);
      } catch {
        // setSelectionRange may throw if textarea not focused — that's OK,
        // cursor will be at end when user taps it next.
      }
    }
  }, [disabled, insertSnippetSignal, onChange, onSnippetInserted]);

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
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header with tabs */}
      <div className="flex items-center border-b border-border bg-muted/50">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "write"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "preview"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          Preview
        </button>
      </div>

      {tab === "write" ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-card">
            <ToolbarBtn onClick={() => linePrefix("# ")} title="Heading 1" disabled={disabled}>
              {I.h1}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => linePrefix("## ")} title="Heading 2" disabled={disabled}>
              {I.h2}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => linePrefix("### ")} title="Heading 3" disabled={disabled}>
              {I.h3}
            </ToolbarBtn>
            <Sep />
            <ToolbarBtn
              onClick={() => wrap("**", "**", "bold")}
              title="Bold (Ctrl+B)"
              disabled={disabled}
            >
              {I.bold}
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => wrap("_", "_", "italic")}
              title="Italic (Ctrl+I)"
              disabled={disabled}
            >
              {I.italic}
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => wrap("~~", "~~", "strikethrough")}
              title="Strikethrough"
              disabled={disabled}
            >
              {I.strike}
            </ToolbarBtn>
            <Sep />
            <ToolbarBtn onClick={() => linePrefix("> ")} title="Quote" disabled={disabled}>
              {I.quote}
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => wrap("`", "`", "code")}
              title="Inline Code (Ctrl+E)"
              disabled={disabled}
            >
              {I.code}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => codeBlock()} title="Code Block (Ctrl+`)" disabled={disabled}>
              {I.code}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertLink()} title="Link (Ctrl+K)" disabled={disabled}>
              {I.link}
            </ToolbarBtn>
            <Sep />
            <ToolbarBtn onClick={() => linePrefix("- ")} title="Bullet List" disabled={disabled}>
              {I.ul}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => linePrefix("1. ")} title="Numbered List" disabled={disabled}>
              {I.ol}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => linePrefix("- [ ] ")} title="Task List" disabled={disabled}>
              {I.task}
            </ToolbarBtn>
            <Sep />
            <ToolbarBtn onClick={() => insertLink(true)} title="Image" disabled={disabled}>
              {I.img}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertTable()} title="Table" disabled={disabled}>
              {I.table}
            </ToolbarBtn>
          </div>

          {/* Textarea */}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-4 py-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none resize-y font-mono text-sm leading-relaxed"
            style={{ minHeight }}
          />
        </>
      ) : (
        <MarkdownEditorPreview
          value={value}
          minHeight={minHeight}
          PreviewComponent={PreviewComponent}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Markdown didukung •{" "}
          <kbd className="px-1 py-0.5 text-[10px] bg-background rounded border border-border">
            Ctrl
          </kbd>
          +
          <kbd className="px-1 py-0.5 text-[10px] bg-background rounded border border-border">
            B
          </kbd>{" "}
          bold,{" "}
          <kbd className="px-1 py-0.5 text-[10px] bg-background rounded border border-border">
            Ctrl
          </kbd>
          +
          <kbd className="px-1 py-0.5 text-[10px] bg-background rounded border border-border">
            I
          </kbd>{" "}
          italic
        </p>
        <span className="text-xs text-muted-foreground">{value.length} karakter</span>
      </div>
    </div>
  );
}
