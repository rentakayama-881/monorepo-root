"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * GitHub-style Markdown Preview
 * 
 * Supports:
 * - GitHub Flavored Markdown (GFM)
 * - Fenced code blocks with language detection
 * - Tables, task lists, strikethrough
 * - Proper inline/block code handling
 */
export default function MarkdownPreview({ content, className = "" }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!content) {
    return (
      <p className="text-[rgb(var(--muted))] italic text-sm">
        Tidak ada konten untuk di-preview
      </p>
    );
  }

  // SSR fallback
  if (!mounted) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-[rgb(var(--surface-2))] rounded w-3/4"></div>
        <div className="h-4 bg-[rgb(var(--surface-2))] rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Headings with GitHub-style border
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold pb-2 mb-4 border-b border-[rgb(var(--border))] text-[rgb(var(--fg))]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold pb-2 mb-3 mt-6 border-b border-[rgb(var(--border))] text-[rgb(var(--fg))]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-5 text-[rgb(var(--fg))]">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-2 mt-4 text-[rgb(var(--fg))]">
              {children}
            </h4>
          ),
          
          // Pre and Code - properly handle fenced code blocks
          pre: ({ children }) => (
            <pre className="my-4 p-4 rounded-md bg-[#161b22] overflow-x-auto text-sm leading-relaxed">
              {children}
            </pre>
          ),
          
          code: ({ node, inline, className, children, ...props }) => {
            // Detect if inside <pre> (fenced code block)
            const isCodeBlock = node?.position && !inline && className;
            const match = /language-(\w+)/.exec(className || "");
            const lang = match ? match[1] : "";
            
            // If there's no className and not explicitly inline, check parent
            // Fenced code blocks will have className like "language-xxx"
            if (!inline && className) {
              // Fenced code block
              return (
                <code 
                  className="block font-mono text-[#e6edf3] whitespace-pre"
                  data-language={lang}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            // Inline code
            return (
              <code 
                className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[rgba(var(--fg),0.08)] text-[rgb(var(--fg))] text-[0.875em] font-mono break-words"
                {...props}
              >
                {children}
              </code>
            );
          },
          
          // Paragraphs
          p: ({ children }) => (
            <p className="my-3 leading-7 text-[rgb(var(--fg))]">
              {children}
            </p>
          ),
          
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[rgb(var(--brand))] hover:underline break-words"
            >
              {children}
            </a>
          ),
          
          // Blockquotes - GitHub style with border
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-4 border-[rgb(var(--border))] text-[rgb(var(--muted))]">
              {children}
            </blockquote>
          ),
          
          // Lists
          ul: ({ children, className }) => {
            const isTaskList = className?.includes("contains-task-list");
            return (
              <ul className={`my-3 ${isTaskList ? "list-none pl-0" : "list-disc pl-6"} space-y-1`}>
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
              <li className={`text-[rgb(var(--fg))] leading-7 ${isTaskItem ? "flex items-start gap-2 list-none" : ""}`}>
                {children}
              </li>
            );
          },
          
          // Checkboxes for task lists
          input: ({ type, checked }) => {
            if (type === "checkbox") {
              return (
                <input 
                  type="checkbox" 
                  checked={checked} 
                  className="mt-1.5 h-4 w-4 rounded border-[rgb(var(--border))] accent-[rgb(var(--brand))] pointer-events-none"
                  readOnly
                />
              );
            }
            return null;
          },
          
          // Tables - GitHub style
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-[rgb(var(--border))]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[rgb(var(--surface-2))]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 border border-[rgb(var(--border))] text-left font-semibold text-[rgb(var(--fg))]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 border border-[rgb(var(--border))] text-[rgb(var(--fg))]">
              {children}
            </td>
          ),
          
          // Images
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt || ""} 
              className="max-w-full h-auto rounded-md my-4"
              loading="lazy"
            />
          ),
          
          // Horizontal rule
          hr: () => (
            <hr className="my-6 border-t border-[rgb(var(--border))]" />
          ),
          
          // Strong/Em
          strong: ({ children }) => (
            <strong className="font-semibold text-[rgb(var(--fg))]">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          
          // Strikethrough (GFM)
          del: ({ children }) => (
            <del className="line-through text-[rgb(var(--muted))]">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
