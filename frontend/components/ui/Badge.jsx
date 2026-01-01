/**
 * Badge display component
 * - Badge: Shows a single badge with icon and optional name
 * - BadgeList: Shows multiple badges (for profile page)
 * - BadgeWithUsername: Shows username with primary badge
 */

export function Badge({
  badge,
  size = "sm",
  showName = false,
  className = "",
}) {
  if (!badge) return null;

  const sizeClasses = {
    xs: "h-4 w-4",
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const containerSizes = {
    xs: "text-xs",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-sm",
  };

  const iconClass = sizeClasses[size] || sizeClasses.sm;
  const containerClass = containerSizes[size] || containerSizes.sm;

  return (
    <span
      className={`inline-flex items-center gap-1 ${containerClass} ${className}`}
      style={{
        color: badge.color || "#6366f1",
      }}
      title={badge.name}
    >
      {badge.icon_url ? (
        <img
          src={badge.icon_url}
          alt={badge.name}
          className={`${iconClass} object-contain flex-shrink-0`}
        />
      ) : (
        <span className={iconClass}>🏆</span>
      )}
      {showName && <span>{badge.name}</span>}
    </span>
  );
}

export function BadgeChip({
  badge,
  onRemove,
  className = "",
}) {
  if (!badge) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${className}`}
      style={{
        backgroundColor: (badge.color || "#6366f1") + "20",
        color: badge.color || "#6366f1",
      }}
    >
      {badge.icon_url && (
        <img
          src={badge.icon_url}
          alt=""
          className="h-4 w-4 object-contain"
        />
      )}
      <span>{badge.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function BadgeList({
  badges = [],
  maxDisplay = 5,
  className = "",
}) {
  if (!badges || badges.length === 0) return null;

  const displayBadges = badges.slice(0, maxDisplay);
  const remaining = badges.length - maxDisplay;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {displayBadges.map((badge, i) => (
        <BadgeChip key={badge.ID || i} badge={badge} />
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]">
          +{remaining} lainnya
        </span>
      )}
    </div>
  );
}

export function UsernameWithBadge({
  username,
  primaryBadge,
  className = "",
  usernameClassName = "",
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={usernameClassName}>{username}</span>
      {primaryBadge && <Badge badge={primaryBadge} size="sm" />}
    </span>
  );
}

export default Badge;
