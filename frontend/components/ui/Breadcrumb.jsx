import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb — navigation breadcrumb from an items array
 *
 * @param {Array<{label: string, href?: string}>} items
 * @param {string} separator - separator character (default "/")
 * @param {number} maxItems - if > 0 and items exceed this, collapse middle items to "..."
 * @param {string} className
 */
const Breadcrumb = memo(function Breadcrumb({
  items = [],
  separator = "/",
  maxItems = 0,
  className,
  ...props
}) {
  if (items.length === 0) return null;

  const visibleItems = collapseItems(items, maxItems);

  return (
    <nav aria-label="Breadcrumb" className={className} {...props}>
      <ol className="flex items-center gap-1.5 text-sm">
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const isEllipsis = item._ellipsis;

          return (
            <li key={index} className="inline-flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-muted-foreground/60 select-none mx-0.5" aria-hidden="true">
                  {separator}
                </span>
              )}
              {isEllipsis ? (
                <span className="text-muted-foreground select-none px-0.5">&#8230;</span>
              ) : isLast ? (
                <span
                  aria-current="page"
                  className="text-foreground font-medium truncate max-w-[200px]"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

/**
 * Collapse middle items when maxItems is set and items exceed the limit.
 * Keeps the first item and last (maxItems - 1) items, replacing the rest with ellipsis.
 */
function collapseItems(items, maxItems) {
  if (maxItems <= 0 || items.length <= maxItems) {
    return items;
  }

  const tailCount = maxItems - 1;
  const head = items.slice(0, 1);
  const tail = items.slice(-tailCount);

  return [...head, { _ellipsis: true, label: "..." }, ...tail];
}

export default Breadcrumb;
