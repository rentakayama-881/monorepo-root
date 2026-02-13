"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

function toPlainText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toPlainText(item)).join("");
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

/**
 * CodeBlock component with copy button
 */
function CodeBlock({ children, className, inline }) {
  const [copied, setCopied] = useState(false);
  const content = toPlainText(children);
  
  if (inline) {
    return (
      <code 
        className="px-1.5 py-0.5 rounded-md bg-muted text-foreground text-[0.875em] font-mono"
      >
        {content}
      </code>
    );
  }
  
  const handleCopy = async () => {
    const code = content.replace(/\n$/, "");
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Copy failed - silently ignore as UI still shows copy button
      setCopied(false);
    }
  };
  
  return (
    <div className="code-block-wrapper group">
      <button
        onClick={handleCopy}
        type="button"
        aria-label={copied ? "Kode tersalin" : "Salin kode"}
        className="code-copy-button absolute top-2 right-2 px-2 py-1 rounded bg-secondary/80 hover:bg-secondary border text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
        title={copied ? "Disalin!" : "Salin kode"}
      >
        {copied ? (
          <span className="inline-flex items-center gap-1 text-success">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path>
            </svg>
            Disalin
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path>
            </svg>
            Salin
          </span>
        )}
      </button>
      <code 
        className={`block font-mono text-foreground whitespace-pre ${className || ''}`}
      >
        {content}
      </code>
    </div>
  );
}

/**
 * GitHub-style Markdown Preview
 * 
 * Features:
 * - GitHub Flavored Markdown (GFM)
 * - Fenced code blocks with syntax highlighting
 * - Code block copy button
 * - Tables, task lists, strikethrough
 * - Theme-aware (respects dark/light mode via CSS variables)
 */
export default function MarkdownPreview({ content, className = "" }) {
  if (!content) {
    return (
      <p className="text-muted-foreground italic text-sm">
        Tidak ada konten untuk di-preview
      </p>
    );
  }

  const shouldHighlight = useMemo(() => content.includes("```"), [content]);
  const rehypePlugins = useMemo(
    () => (shouldHighlight ? [rehypeHighlight] : []),
    [shouldHighlight]
  );

  return (
    <div className={`markdown-body text-foreground ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          // === HEADINGS ===
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold pb-2 mb-4 border-b border-border text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold pb-2 mb-3 mt-6 border-b border-border text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-5 text-foreground">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-2 mt-4 text-foreground">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold mb-2 mt-3 text-foreground">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-semibold mb-2 mt-3 text-muted-foreground">
              {children}
            </h6>
          ),
          
          // === CODE BLOCKS ===
          // Pre wrapper - styled via globals.css .markdown-body pre
          pre: ({ children }) => (
            <pre className="relative my-4 p-4 rounded-lg bg-muted/50 border border-border overflow-x-auto text-sm leading-relaxed">
              {children}
            </pre>
          ),
          
          // Code - handles both inline and block
          code: ({ inline, className, children }) => {
            const text = toPlainText(children);
            const isInline = typeof inline === "boolean" ? inline : (!className && !text.includes("\n"));
            return (
              <CodeBlock inline={isInline} className={className}>
                {children}
              </CodeBlock>
            );
          },
          
          // === TEXT ELEMENTS ===
          p: ({ children }) => (
            <p className="my-3 leading-7 text-foreground">
              {children}
            </p>
          ),
          
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          
          del: ({ children }) => (
            <del className="line-through text-muted-foreground">{children}</del>
          ),
          
          // === LINKS ===
          a: ({ href, children }) => {
            const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
            return (
              <a 
                href={href} 
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="text-primary hover:underline break-words inline-flex items-center gap-1"
              >
                {children}
                {isExternal && (
                  <svg className="w-3 h-3 inline opacity-70" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.75 2h3.5a.75.75 0 010 1.5h-3.5a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-3.5a.75.75 0 011.5 0v3.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 01.25.25v4.146a.25.25 0 01-.427.177L13.03 4.03 9.28 7.78a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0110.604 1z"></path>
                  </svg>
                )}
              </a>
            );
          },
          
          // === BLOCKQUOTES ===
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-4 border-primary/30 text-muted-foreground bg-muted/30 py-2 rounded-r">
              {children}
            </blockquote>
          ),
          
          // === LISTS ===
          ul: ({ children, className }) => {
            const isTaskList = className?.includes("contains-task-list");
            return (
              <ul className={`my-3 ${isTaskList ? "list-none pl-0 space-y-2" : "list-disc pl-6 space-y-1"}`}>
                {children}
              </ul>
            );
          },
          
          ol: ({ children }) => (
            <ol className="my-3 list-decimal pl-6 space-y-1">
              {children}
            </ol>
          ),
          
          li: ({ children, className }) => {
            const isTaskItem = className?.includes("task-list-item");
            return (
              <li className={`text-foreground leading-7 ${isTaskItem ? "flex items-start gap-2 list-none" : ""}`}>
                {children}
              </li>
            );
          },
          
          // Task list checkbox
          input: ({ type, checked }) => {
            if (type === "checkbox") {
              return (
                <input 
                  type="checkbox" 
                  checked={checked} 
                  className="mt-1 h-4 w-4 rounded border-border accent-primary pointer-events-none"
                  readOnly
                />
              );
            }
            return null;
          },
          
          // === TABLES ===
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full border-collapse">
                {children}
              </table>
            </div>
          ),
          
          thead: ({ children }) => (
            <thead className="bg-muted/50">
              {children}
            </thead>
          ),
          
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border">
              {children}
            </tbody>
          ),
          
          tr: ({ children }) => (
            <tr className="hover:bg-accent/50 transition-colors">
              {children}
            </tr>
          ),
          
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
              {children}
            </th>
          ),
          
          td: ({ children }) => (
            <td className="px-4 py-2 text-foreground">
              {children}
            </td>
          ),
          
          // === MEDIA ===
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt || ""} 
              className="markdown-image max-w-full h-auto rounded-lg my-4 border border-border hover:shadow-lg transition-shadow"
              loading="lazy"
            />
          ),
          
          // === DIVIDERS ===
          hr: () => (
            <hr className="my-6 border-t border-border" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
