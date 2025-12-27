"use client";

import { useState, useRef, useCallback } from "react";

/**
 * GitHub-style Markdown Editor with toolbar and preview
 * 
 * Features:
 * - Toolbar: Heading, Bold, Italic, Quote, Code, Link, List
 * - Write/Preview tabs
 * - Keyboard shortcuts
 * - Auto-insert markdown syntax
 */

// Toolbar button component
function ToolbarButton({ onClick, title, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

// Toolbar separator
function ToolbarSeparator() {
  return <div className="w-px h-5 bg-[rgb(var(--border))] mx-1" />;
}

// Icons as simple SVGs
const Icons = {
  heading: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.75 2a.75.75 0 01.75.75V7h7V2.75a.75.75 0 011.5 0v10.5a.75.75 0 01-1.5 0V8.5h-7v4.75a.75.75 0 01-1.5 0V2.75A.75.75 0 013.75 2z"/>
    </svg>
  ),
  bold: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2a1 1 0 00-1 1v10a1 1 0 001 1h5.5a3.5 3.5 0 001.852-6.47A3.5 3.5 0 008.5 2H4zm4.5 5a1.5 1.5 0 100-3H5v3h3.5zM5 9v3h4.5a1.5 1.5 0 000-3H5z"/>
    </svg>
  ),
  italic: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 2.75A.75.75 0 016.75 2h6.5a.75.75 0 010 1.5h-2.505l-3.858 9H9.25a.75.75 0 010 1.5h-6.5a.75.75 0 010-1.5h2.505l3.858-9H6.75A.75.75 0 016 2.75z"/>
    </svg>
  ),
  quote: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.75 2.5a.75.75 0 000 1.5h10.5a.75.75 0 000-1.5H1.75zm4 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM2.5 7.75a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6z"/>
    </svg>
  ),
  code: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
    </svg>
  ),
  codeBlock: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75zM8 5.5a.75.75 0 01.75.75v.75h.75a.75.75 0 010 1.5h-.75v.75a.75.75 0 01-1.5 0v-.75h-.75a.75.75 0 010-1.5h.75v-.75A.75.75 0 018 5.5z"/>
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.025 5.45a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25z"/>
    </svg>
  ),
  listUnordered: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 4a1 1 0 100-2 1 1 0 000 2zm3.75-1.5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM3 8a1 1 0 11-2 0 1 1 0 012 0zm-1 6a1 1 0 100-2 1 1 0 000 2z"/>
    </svg>
  ),
  listOrdered: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.003 2.5a.5.5 0 00-.723-.447l-1.003.5a.5.5 0 00.446.895l.28-.14V6H.5a.5.5 0 000 1h2.006a.5.5 0 100-1h-.503V2.5zM5 3.25a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 3.25zm0 5a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 8.25zm0 5a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.75-.75zM.924 10.32l.003-.004a.851.851 0 01.144-.153A.66.66 0 011.5 10c.195 0 .306.068.374.146a.57.57 0 01.128.376c0 .453-.269.682-.8 1.078l-.035.025C.692 11.98 0 12.495 0 13.5a.5.5 0 00.5.5h2.003a.5.5 0 000-1H1.146c.132-.197.351-.372.654-.597l.047-.035c.47-.35 1.156-.858 1.156-1.845 0-.365-.118-.744-.377-1.038-.268-.303-.658-.485-1.126-.485-.48 0-.84.202-1.068.392a1.858 1.858 0 00-.348.384l-.007.011-.002.004-.001.002-.001.001a.5.5 0 00.851.525zM.5 10.055l-.427-.26.427.26z"/>
    </svg>
  ),
  taskList: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.5 1.75a.25.25 0 01.25-.25h10.5a.25.25 0 01.25.25v1.5a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25v-1.5zm0 4a.25.25 0 01.25-.25h10.5a.25.25 0 01.25.25v1.5a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25v-1.5zm0 4a.25.25 0 01.25-.25h10.5a.25.25 0 01.25.25v1.5a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25v-1.5zm-1-9A1.75 1.75 0 013.25 0h10.5c.966 0 1.75.784 1.75 1.75v1.5A1.75 1.75 0 0113.75 5H3.25A1.75 1.75 0 011.5 3.25v-1.5zm0 4A1.75 1.75 0 013.25 4h10.5c.966 0 1.75.784 1.75 1.75v1.5A1.75 1.75 0 0113.75 9H3.25A1.75 1.75 0 011.5 7.25v-1.5zm0 4a1.75 1.75 0 011.75-1.75h10.5c.966 0 1.75.784 1.75 1.75v1.5a1.75 1.75 0 01-1.75 1.75H3.25a1.75 1.75 0 01-1.75-1.75v-1.5z"/>
    </svg>
  ),
  image: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h.94a.76.76 0 01.03-.03l6.077-6.078a1.75 1.75 0 012.412-.06L14.5 10.31V2.75a.25.25 0 00-.25-.25H1.75zm12.5 11H4.81l5.048-5.047a.25.25 0 01.344-.009l4.298 3.889v.917a.25.25 0 01-.25.25zm1.75-11v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75zM5.5 6a.5.5 0 11-1 0 .5.5 0 011 0zM7 6a2 2 0 11-4 0 2 2 0 014 0z"/>
    </svg>
  ),
};

export default function MarkdownEditor({
  value = "",
  onChange,
  placeholder = "Tulis dengan Markdown...",
  minHeight = "200px",
  disabled = false,
  preview: PreviewComponent,
}) {
  const [activeTab, setActiveTab] = useState("write");
  const textareaRef = useRef(null);

  // Insert text at cursor position
  const insertText = useCallback((before, after = "", placeholder = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newValue = 
      value.substring(0, start) + 
      before + 
      textToInsert + 
      after + 
      value.substring(end);
    
    onChange(newValue);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + textToInsert.length;
      textarea.setSelectionRange(
        selectedText ? newCursorPos + after.length : start + before.length,
        selectedText ? newCursorPos + after.length : start + before.length + (placeholder ? placeholder.length : 0)
      );
    }, 0);
  }, [value, onChange]);

  // Insert at line start
  const insertAtLineStart = useCallback((prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    
    const newValue = 
      value.substring(0, lineStart) + 
      prefix + 
      value.substring(lineStart);
    
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  }, [value, onChange]);

  // Toolbar actions
  const actions = {
    heading: () => insertAtLineStart("## "),
    bold: () => insertText("**", "**", "bold text"),
    italic: () => insertText("_", "_", "italic text"),
    quote: () => insertAtLineStart("> "),
    code: () => insertText("`", "`", "code"),
    codeBlock: () => insertText("\n```\n", "\n```\n", "code block"),
    link: () => insertText("[", "](url)", "link text"),
    image: () => insertText("![", "](url)", "alt text"),
    listUnordered: () => insertAtLineStart("- "),
    listOrdered: () => insertAtLineStart("1. "),
    taskList: () => insertAtLineStart("- [ ] "),
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "b":
          e.preventDefault();
          actions.bold();
          break;
        case "i":
          e.preventDefault();
          actions.italic();
          break;
        case "k":
          e.preventDefault();
          actions.link();
          break;
        case "e":
          e.preventDefault();
          actions.code();
          break;
      }
    }
  };

  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[rgb(var(--border))]">
        <button
          type="button"
          onClick={() => setActiveTab("write")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "write"
              ? "text-[rgb(var(--fg))] border-b-2 border-[rgb(var(--brand))] -mb-px"
              : "text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "preview"
              ? "text-[rgb(var(--fg))] border-b-2 border-[rgb(var(--brand))] -mb-px"
              : "text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
          }`}
        >
          Preview
        </button>
      </div>

      {activeTab === "write" ? (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
            <ToolbarButton onClick={actions.heading} title="Heading (H2)" disabled={disabled}>
              {Icons.heading}
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton onClick={actions.bold} title="Bold (Ctrl+B)" disabled={disabled}>
              {Icons.bold}
            </ToolbarButton>
            <ToolbarButton onClick={actions.italic} title="Italic (Ctrl+I)" disabled={disabled}>
              {Icons.italic}
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton onClick={actions.quote} title="Quote" disabled={disabled}>
              {Icons.quote}
            </ToolbarButton>
            <ToolbarButton onClick={actions.code} title="Inline Code (Ctrl+E)" disabled={disabled}>
              {Icons.code}
            </ToolbarButton>
            <ToolbarButton onClick={actions.codeBlock} title="Code Block" disabled={disabled}>
              {Icons.codeBlock}
            </ToolbarButton>
            <ToolbarButton onClick={actions.link} title="Link (Ctrl+K)" disabled={disabled}>
              {Icons.link}
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton onClick={actions.listUnordered} title="Bullet List" disabled={disabled}>
              {Icons.listUnordered}
            </ToolbarButton>
            <ToolbarButton onClick={actions.listOrdered} title="Numbered List" disabled={disabled}>
              {Icons.listOrdered}
            </ToolbarButton>
            <ToolbarButton onClick={actions.taskList} title="Task List" disabled={disabled}>
              {Icons.taskList}
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton onClick={actions.image} title="Image" disabled={disabled}>
              {Icons.image}
            </ToolbarButton>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-3 py-2 bg-transparent text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus:outline-none resize-y font-mono text-sm"
            style={{ minHeight }}
          />
        </>
      ) : (
        /* Preview */
        <div 
          className="px-4 py-3 overflow-auto"
          style={{ minHeight }}
        >
          {value ? (
            PreviewComponent ? (
              <PreviewComponent content={value} />
            ) : (
              <div className="prose prose-neutral dark:prose-invert max-w-none text-sm">
                <p className="text-[rgb(var(--muted))] italic">
                  Install react-markdown untuk melihat preview
                </p>
                <pre className="whitespace-pre-wrap text-[rgb(var(--fg))]">{value}</pre>
              </div>
            )
          ) : (
            <p className="text-[rgb(var(--muted))] italic text-sm">
              Tidak ada yang bisa di-preview
            </p>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
        <p className="text-xs text-[rgb(var(--muted))]">
          Mendukung Markdown. Gunakan **bold**, _italic_, `code`, [link](url), dan lainnya.
        </p>
      </div>
    </div>
  );
}
