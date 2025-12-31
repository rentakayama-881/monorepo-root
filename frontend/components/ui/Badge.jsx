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

  // Ukuran diperbesar dari sebelumnya
  const sizeClasses = {
    xs:  "h-8 w-8",     // sebelumnya h-6 w-6 (24px -> 32px)
    sm: "h-10 w-10",   // sebelumnya h-7 w-7 (28px -> 40px)
    md: "h-12 w-12",   // sebelumnya h-8 w-8 (32px -> 48px)
    lg: "h-14 w-14",   // sebelumnya h-9 w-9 (36px -> 56px)
  };

  const containerSizes = {
    xs: "text-sm",     // sebelumnya text-xs
    sm: "text-sm",     // sebelumnya text-xs
    md: "text-base",   // sebelumnya text-sm
    lg:  "text-lg",     // sebelumnya text-sm
  };

  const iconClass = sizeClasses[size] || sizeClasses.sm;
  const containerClass = containerSizes[size] || containerSizes.sm;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${containerClass} ${className}`}
      style={{
        color: badge.color || "#6366f1",
      }}
      title={badge.name}
    >
      {badge.icon_url ? (
        <img
          src={badge.icon_url}
          alt={badge. name}
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
  size = "md",  // Tambah prop size dengan default "md"
  className = "",
}) {
  if (!badge) return null;

  // Ukuran badge chip yang lebih besar
  const chipSizes = {
    sm: { icon: "h-4 w-4", padding: "px-2 py-1", text: "text-xs" },
    md: { icon: "h-5 w-5", padding: "px-3 py-1.5", text: "text-sm" },
    lg: { icon: "h-6 w-6", padding: "px-4 py-2", text: "text-base" },
  };

  const sizeConfig = chipSizes[size] || chipSizes.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeConfig.padding} rounded-full ${sizeConfig.text} ${className}`}
      style={{
        backgroundColor: (badge. color || "#6366f1") + "20",
        color:  badge.color || "#6366f1",
      }}
    >
      {badge.icon_url && (
        <img
          src={badge.icon_url}
          alt=""
          className={`${sizeConfig.icon} object-contain`}
        />
      )}
      <span className="font-medium">{badge.name}</span>
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
  size = "md",  // Tambah prop size
  className = "",
}) {
  if (!badges || badges.length === 0) return null;

  const displayBadges = badges.slice(0, maxDisplay);
  const remaining = badges.length - maxDisplay;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {displayBadges.map((badge, i) => (
        <BadgeChip key={badge.ID || i} badge={badge} size={size} />
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]">
          +{remaining} lainnya
        </span>
      )}
    </div>
  );
}

export function UsernameWithBadge({
  username,
  primaryBadge,
  badgeSize = "sm",  // Tambah prop untuk kontrol ukuran badge
  className = "",
  usernameClassName = "",
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={usernameClassName}>{username}</span>
      {primaryBadge && <Badge badge={primaryBadge} size={badgeSize} />}
    </span>
  );
}

export default Badge;
