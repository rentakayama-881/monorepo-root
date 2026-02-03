'use client';

import clsx from 'clsx';
import { TagIcon } from './TagIcons';

/**
 * GitHub-style Tag Pill Component
 * Displays a single tag with icon and color
 */
export function TagPill({
  tag,
  size = 'sm',
  className = "",
  onClick = null,
  onRemove = null,
  selected = false,
}) {
  const isClickable = typeof onClick === "function";
  const canRemove = !isClickable && typeof onRemove === "function";
  const Component = isClickable ? "button" : "span";
  
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] leading-4',
    sm: 'px-2.5 py-1 text-xs leading-4',
    md: 'px-3 py-1.5 text-sm leading-5',
    lg: 'px-4 py-2 text-sm leading-5',
  };

  return (
    <Component
      onClick={onClick}
      type={isClickable ? "button" : undefined}
      aria-pressed={isClickable ? selected : undefined}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium select-none",
        "bg-secondary text-foreground border-border",
        isClickable && "cursor-pointer hover:bg-accent hover:border-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected && "bg-primary/10 text-primary border-primary/20",
        sizeClasses[size],
        className
      )}
    >
      <TagIcon
        name={tag?.icon || "tag"}
        className={clsx(
          size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5",
          selected ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span>{tag.name}</span>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove?.(tag.slug)}
          className={clsx(
            "ml-0.5 inline-flex items-center justify-center rounded-full p-0.5",
            "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          )}
          aria-label={`Remove ${tag.name}`}
        >
          <TagIcon name="x" className="h-3 w-3" />
        </button>
      )}
    </Component>
  );
}

/**
 * Tag List Component
 * Displays multiple tags in a horizontal list
 */
export function TagList({ tags, size = 'sm', maxDisplay = null, className = "" }) {
  const displayTags = maxDisplay ? tags.slice(0, maxDisplay) : tags;
  const remainingCount = maxDisplay && tags.length > maxDisplay ? tags.length - maxDisplay : 0;

  return (
    <div className={clsx("flex flex-wrap items-center gap-1.5", className)}>
      {displayTags.map((tag) => (
        <TagPill key={tag.slug} tag={tag} size={size} />
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-muted-foreground ml-1">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

export default TagPill;
