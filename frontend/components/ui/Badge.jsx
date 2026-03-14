/**
 * Badge System - Styled like prompts.chat verified badges
 */

import clsx from "clsx";
import Link from "next/link";
import { sizeConfig, renderBadgeIcon, getBadgeTone, getBadgeConfig } from "./badge-variants";

/**
 * Badge Component - Main badge display
 */
export function Badge({
  badge,
  type,
  size = "sm",
  showLabel = false,
  variant = "icon", // "icon" | "chip" | "inline" | "pulse"
  className = "",
  ...props
}) {
  const config = getBadgeConfig(badge, type);
  const sizes = sizeConfig[size] || sizeConfig.sm;
  const tone = getBadgeTone(config);

  // Pulse variant (animated for notifications)
  if (variant === "pulse") {
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-sm border font-medium animate-pulse-subtle",
          sizes.gap,
          sizes.text,
          sizes.padding,
          className
        )}
        style={{
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
          color: tone.color,
        }}
        title={config.label}
        {...props}
      >
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.color }}
          ></span>
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: config.color }}
          ></span>
        </span>
        {renderBadgeIcon(config, sizes.icon)}
        {(showLabel || variant === "pulse") && <span>{config.label}</span>}
      </span>
    );
  }

  // Icon-only variant (inline with username)
  if (variant === "icon") {
    return (
      <span
        className={clsx("inline-flex items-center shrink-0", className)}
        style={{ color: tone.color }}
        title={config.label}
        {...props}
      >
        {renderBadgeIcon(config, sizes.icon)}
      </span>
    );
  }

  // Inline variant (icon + label, no background)
  if (variant === "inline") {
    return (
      <span
        className={clsx("inline-flex items-center font-medium", sizes.gap, sizes.text, className)}
        style={{ color: tone.color }}
        title={config.label}
        {...props}
      >
        {renderBadgeIcon(config, sizes.icon)}
        {showLabel && <span>{config.label}</span>}
      </span>
    );
  }

  // Chip variant (with background)
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-[var(--radius)] border font-medium w-fit whitespace-nowrap shrink-0 overflow-hidden",
        sizes.gap,
        sizes.text,
        sizes.padding,
        className
      )}
      style={{
        backgroundColor: tone.backgroundColor,
        borderColor: tone.borderColor,
        color: tone.color,
      }}
      title={config.label}
      {...props}
    >
      {renderBadgeIcon(config, sizes.icon)}
      {(showLabel || variant === "chip") && <span>{config.label}</span>}
    </span>
  );
}

/**
 * BadgeChip - Badge displayed as a chip (for lists)
 */
export function BadgeChip({ badge, onRemove, size = "sm", className = "" }) {
  if (!badge) return null;

  const config = getBadgeConfig(badge);
  const sizes = sizeConfig[size] || sizeConfig.sm;
  const tone = getBadgeTone(config);

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-[var(--radius)] border font-medium transition-all w-fit whitespace-nowrap shrink-0 overflow-hidden",
        "border hover:shadow-sm",
        sizes.gap,
        sizes.text,
        sizes.padding,
        className
      )}
      style={{
        backgroundColor: tone.backgroundColor,
        borderColor: tone.borderColor,
        color: tone.color,
      }}
      title={badge?.description || badge?.Description || config.label}
    >
      {renderBadgeIcon(config, sizes.icon)}
      <span>{config.label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 -mr-1 p-0.5 rounded-sm hover:bg-current/10 transition-all active:scale-90"
          aria-label={`Remove ${config.label}`}
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </span>
  );
}

/**
 * BadgeList - Display multiple badges
 */
export function BadgeList({ badges = [], maxDisplay = 5, size = "sm", className = "" }) {
  if (!badges || badges.length === 0) return null;

  const displayBadges = badges.slice(0, maxDisplay);
  const remaining = badges.length - maxDisplay;

  return (
    <div className={clsx("flex flex-wrap items-center gap-1.5", className)}>
      {displayBadges.map((badge, i) => (
        <BadgeChip key={badge.id || badge.ID || i} badge={badge} size={size} />
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-secondary text-muted-foreground">
          +{remaining} lainnya
        </span>
      )}
    </div>
  );
}

/**
 * UsernameWithBadge - Display username with primary badge (prompts.chat style)
 */
export function UsernameWithBadge({
  username,
  primaryBadge,
  verified = false,
  isAdmin = false,
  size = "sm",
  linkToProfile = false,
  className = "",
  usernameClassName = "",
}) {
  const content = (
    <span className={clsx("inline-flex items-center gap-1", className)}>
      <span className={clsx("font-medium", usernameClassName)}>@{username}</span>
      {verified && <Badge type="verified" size={size} />}
      {isAdmin && <Badge type="admin" size={size} />}
      {primaryBadge && !verified && !isAdmin && <Badge badge={primaryBadge} size={size} />}
    </span>
  );

  if (linkToProfile && username) {
    return (
      <Link href={`/user/${username}`} className="hover:underline transition-colors">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * VerifiedBadge - Quick verified badge (prompts.chat style)
 */
export function VerifiedBadge({ size = "sm", className = "" }) {
  return <Badge type="verified" size={size} className={className} />;
}

/**
 * AdminBadge - Quick admin badge
 */
export function AdminBadge({ size = "sm", className = "" }) {
  return <Badge type="admin" size={size} className={className} />;
}

export default Badge;
