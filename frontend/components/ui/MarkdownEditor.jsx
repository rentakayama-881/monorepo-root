"use client";

import { useState, useRef, useEffect } from "react";
import { ToolbarBtn, Sep, I, MarkdownEditorPreview } from "./markdownEditorUtils";
import { useMarkdownActions } from "./useMarkdownActions";

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

  const { wrap, linePrefix, codeBlock, insertLink, insertTable } = useMarkdownActions(
    value,
    onChange,
    ref
  );

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
