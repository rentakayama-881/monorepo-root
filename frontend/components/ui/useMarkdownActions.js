import { useCallback } from "react";

/**
 * Custom hook encapsulating all Markdown text-manipulation actions.
 * Returns { wrap, linePrefix, codeBlock, insertLink, insertTable }.
 */
export function useMarkdownActions(value, onChange, textareaRef) {
  // Wrap selected text or insert at cursor
  const wrap = useCallback(
    (before, after = "", defaultText = "") => {
      const ta = textareaRef.current;
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
    [value, onChange, textareaRef]
  );

  // Insert at beginning of current line(s)
  const linePrefix = useCallback(
    (prefix) => {
      const ta = textareaRef.current;
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
    [value, onChange, textareaRef]
  );

  // Insert code block
  const codeBlock = useCallback(
    (lang = "") => {
      const ta = textareaRef.current;
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
    [value, onChange, textareaRef]
  );

  // Insert link/image
  const insertLink = useCallback(
    (isImage = false) => {
      const ta = textareaRef.current;
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
    [value, onChange, textareaRef]
  );

  // Insert table
  const insertTable = useCallback(() => {
    const ta = textareaRef.current;
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
  }, [value, onChange, textareaRef]);

  return { wrap, linePrefix, codeBlock, insertLink, insertTable };
}
