'use client';

import clsx from 'clsx';

/**
 * GitHub-style Tag Pill Component
 * Displays a single tag with icon and color
 */
export function TagPill({ tag, size = 'sm', className = "", onClick = null }) {
  const Component = onClick ? 'button' : 'span';
  
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-sm',
  };

  return (
    <Component
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-medium border transition-colors",
        sizeClasses[size],
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      style={{
        backgroundColor: `${tag.color}10`,
        borderColor: `${tag.color}40`,
        color: tag.color
      }}
    >
      {tag.icon && (
        <span className="text-xs leading-none">{getIconEmoji(tag.icon)}</span>
      )}
      <span>{tag.name}</span>
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

// Helper function for emoji icons
function getIconEmoji(iconName) {
  const icons = {
    'briefcase': '💼',
    'tag': '🏷️',
    'search': '🔍',
    'people': '👥',
    'git-merge': '🔀',
    'question': '❓',
    'comment-discussion': '💬',
    'megaphone': '📢',
    'book': '📖',
    'star': '⭐',
  };
  return icons[iconName] || '🏷️';
}

export default TagPill;
