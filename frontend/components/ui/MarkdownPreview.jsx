"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * GitHub-style Markdown Preview
 * 
 * Features:
 * - GitHub Flavored Markdown (GFM)
 * - Fenced code blocks with syntax highlighting
 * - Tables, task lists, strikethrough
 * - Theme-aware (respects dark/light mode via CSS variables)
 */
export default function MarkdownPreview({ content, className = "" }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!content) {
    return (
      <p className="text-muted-foreground italic text-sm">
        Tidak ada konten untuk di-preview
      </p>
    );
  }

  // SSR fallback - prevents hydration mismatch
  if (!mounted) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-secondary rounded w-3/4"></div>
        <div className="h-4 bg-secondary rounded w-1/2"></div>
        <div className="h-4 bg-secondary rounded w-5/6"></div>
      </div>
    );
  }

  return (
    <div className={`markdown-body text-foreground ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
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
            <pre className="my-4 p-4 rounded-lg bg-muted/50 border border-border overflow-x-auto text-sm leading-relaxed">
              {children}
            </pre>
          ),
          
          // Code - handles both inline and block
          code: ({ node, inline, className, children, ...props }) => {
            const hasLang = /language-(\w+)/.exec(className || "");
            
            // Block code (inside pre, has language class from highlight)
            if (!inline && className) {
              return (
                <code 
                  className={`block font-mono text-foreground whitespace-pre ${className}`}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            // Inline code
            return (
              <code 
                className="px-1.5 py-0.5 rounded-md bg-muted text-foreground text-[0.875em] font-mono"
                {...props}
              >
                {children}
              </code>
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
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline break-words"
            >
              {children}
            </a>
          ),
          
          // === BLOCKQUOTES ===
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-4 border-border text-muted-foreground">
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
            <tr className="hover:bg-accent/50">
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
              className="max-w-full h-auto rounded-lg my-4 border border-border"
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
