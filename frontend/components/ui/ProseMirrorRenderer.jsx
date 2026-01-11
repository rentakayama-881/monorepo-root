"use client";

/**
 * ProseMirror JSON to React renderer
 * Converts ProseMirror document JSON to React elements
 * Theme-aware: uses CSS variables for dark/light mode support
 */

export default function ProseMirrorRenderer({ content }) {
  if (!content) return <p className="text-muted-foreground">Tidak ada konten.</p>;
  
  // If content is a string, just render it
  if (typeof content === "string") {
    return <p className="text-foreground">{content}</p>;
  }

  // Handle ProseMirror doc format
  if (content.type === "doc" && Array.isArray(content.content)) {
    return <div className="prosemirror-content text-foreground">{content.content.map((node, idx) => renderNode(node, idx))}</div>;
  }

  // Fallback: render as JSON
  return <pre className="text-xs whitespace-pre-wrap font-mono bg-secondary text-foreground p-4 rounded">{JSON.stringify(content, null, 2)}</pre>;
}

function renderNode(node, key) {
  if (!node) return null;

  switch (node.type) {
    case "heading":
      return renderHeading(node, key);
    case "paragraph":
      return <p key={key} className="mb-3 text-foreground">{renderContent(node.content)}</p>;
    case "bulletList":
      return <ul key={key} className="list-disc pl-6 mb-4 space-y-1 text-foreground">{renderListItems(node.content)}</ul>;
    case "orderedList":
      return <ol key={key} className="list-decimal pl-6 mb-4 space-y-1 text-foreground">{renderListItems(node.content)}</ol>;
    case "listItem":
      return <li key={key} className="text-foreground">{renderContent(node.content?.[0]?.content)}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
          {node.content?.map((child, idx) => renderNode(child, idx))}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre key={key} className="bg-secondary text-foreground p-4 rounded-[var(--radius)] overflow-x-auto my-4 text-sm font-mono">
          <code>{renderContent(node.content)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} className="my-6 border-border" />;
    case "hardBreak":
      return <br key={key} />;
    default:
      // For unknown types, try to render content or return null
      if (node.content) {
        return <div key={key} className="text-foreground">{node.content.map((child, idx) => renderNode(child, idx))}</div>;
      }
      return null;
  }
}

function renderHeading(node, key) {
  const level = node.attrs?.level || 2;
  const content = renderContent(node.content);
  
  const headingClasses = {
    1: "text-2xl font-bold mb-4 mt-6 text-foreground",
    2: "text-xl font-semibold mb-3 mt-5 text-foreground",
    3: "text-lg font-semibold mb-2 mt-4 text-foreground",
    4: "text-base font-semibold mb-2 mt-3 text-foreground",
    5: "text-sm font-semibold mb-1 mt-2 text-foreground",
    6: "text-sm font-medium mb-1 mt-2 text-foreground",
  };

  const Tag = `h${level}`;
  return <Tag key={key} className={headingClasses[level] || headingClasses[2]}>{content}</Tag>;
}

function renderListItems(items) {
  if (!Array.isArray(items)) return null;
  return items.map((item, idx) => {
    // listItem contains paragraph(s)
    const paragraphs = item.content || [];
    return (
      <li key={idx} className="text-foreground">
        {paragraphs.map((p, pIdx) => {
          if (p.type === "paragraph") {
            return <span key={pIdx} className="text-inherit">{renderContent(p.content)}</span>;
          }
          return renderNode(p, pIdx);
        })}
      </li>
    );
  });
}

function renderContent(content) {
  if (!content) return null;
  if (!Array.isArray(content)) return String(content);

  return content.map((item, idx) => {
    if (item.type === "text") {
      return renderText(item, idx);
    }
    // Handle nested nodes
    return renderNode(item, idx);
  });
}

function renderText(textNode, key) {
  let text = textNode.text || "";
  const marks = textNode.marks || [];

  // If no marks, return plain text
  if (marks.length === 0) {
    return text;
  }

  // Apply marks (bold, italic, code, etc.)
  // Use text-inherit to inherit color from parent for dark/light mode support
  let element = text;

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        element = <strong key={key} className="font-semibold text-inherit">{element}</strong>;
        break;
      case "italic":
        element = <em key={key} className="text-inherit">{element}</em>;
        break;
      case "code":
        element = <code key={key} className="bg-secondary text-foreground px-1.5 py-0.5 rounded text-sm font-mono">{element}</code>;
        break;
      case "strike":
        element = <s key={key} className="text-inherit">{element}</s>;
        break;
      case "underline":
        element = <u key={key} className="text-inherit">{element}</u>;
        break;
      case "link":
        element = (
          <a 
            key={key} 
            href={mark.attrs?.href || "#"} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {element}
          </a>
        );
        break;
      default:
        break;
    }
  }

  return element;
}
