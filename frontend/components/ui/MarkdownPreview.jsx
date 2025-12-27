"use client";

import dynamic from "next/dynamic";

// Dynamically import react-markdown to avoid SSR issues
const ReactMarkdown = dynamic(
  () => import("react-markdown").then((mod) => mod.default),
  { 
    ssr: false,
    loading: () => <div className="animate-pulse h-20 bg-[rgb(var(--surface-2))] rounded" />
  }
);

// Dynamically import remark-gfm
const remarkGfm = dynamic(
  () => import("remark-gfm").then((mod) => mod.default),
  { ssr: false }
);

/**
 * MarkdownPreview - Renders markdown content as HTML
 * 
 * Uses react-markdown with GitHub Flavored Markdown (GFM) support:
 * - Tables
 * - Task lists
 * - Strikethrough
 * - Autolinks
 */
export default function MarkdownPreview({ content, className = "" }) {
  if (!content) {
    return (
      <p className="text-[rgb(var(--muted))] italic text-sm">
        Tidak ada konten
      </p>
    );
  }

  return (
    <div className={`prose prose-neutral dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[[remarkGfm]]}
        components={{
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold border-b border-[rgb(var(--border))] pb-2 mb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold border-b border-[rgb(var(--border))] pb-2 mb-3 mt-6">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-5">
              {children}
            </h3>
          ),
          // Code blocks
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code 
                  className="px-1.5 py-0.5 rounded bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))] text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-4 rounded-lg bg-[rgb(var(--surface-2))] overflow-x-auto">
                <code className="text-sm font-mono text-[rgb(var(--fg))]" {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[rgb(var(--brand))] hover:underline"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[rgb(var(--border))] pl-4 italic text-[rgb(var(--muted))]">
              {children}
            </blockquote>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2">
              {children}
            </ol>
          ),
          // Task lists (GFM)
          li: ({ children, className }) => {
            // Check if this is a task list item
            if (className?.includes("task-list-item")) {
              return (
                <li className="list-none flex items-start gap-2">
                  {children}
                </li>
              );
            }
            return <li className="text-[rgb(var(--fg))]">{children}</li>;
          },
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-[rgb(var(--border))] rounded-lg">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 bg-[rgb(var(--surface-2))] border-b border-[rgb(var(--border))] text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 border-b border-[rgb(var(--border))]">
              {children}
            </td>
          ),
          // Images
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt || ""} 
              className="max-w-full h-auto rounded-lg my-4"
              loading="lazy"
            />
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-6 border-[rgb(var(--border))]" />
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="my-2 text-[rgb(var(--fg))] leading-relaxed">
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Simple fallback preview for when react-markdown is not installed
 */
export function MarkdownPreviewFallback({ content }) {
  if (!content) {
    return (
      <p className="text-[rgb(var(--muted))] italic text-sm">
        Tidak ada konten
      </p>
    );
  }

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-[rgb(var(--fg))]">
      {content}
    </div>
  );
}
