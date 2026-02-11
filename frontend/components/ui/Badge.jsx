/**
 * Badge System - Styled like prompts.chat verified badges
 * 
 * Badge types:
 * - verified: Blue checkmark (like prompts.chat)
 * - admin: Shield icon
 * - moderator: Star icon
 * - contributor: Code icon
 * - premium: Crown icon
 * - custom: Custom color/icon from database
 */

import clsx from "clsx";
import Link from "next/link";

// Badge icon components (outline style, GitHub-like)
const BadgeIcons = {
  verified: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  admin: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  moderator: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  ),
  contributor: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
  ),
  premium: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  ),
  checkmark: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  trusted: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  default: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    </svg>
  ),
};

// Preset badge types with colors
const BadgePresets = {
  verified: { color: "#3b82f6", icon: "checkmark", label: "Verified" },
  admin: { color: "#ef4444", icon: "admin", label: "Admin" },
  moderator: { color: "#f59e0b", icon: "moderator", label: "Moderator" },
  contributor: { color: "#8b5cf6", icon: "contributor", label: "Contributor" },
  premium: { color: "#eab308", icon: "premium", label: "Premium" },
  trusted: { color: "#22c55e", icon: "trusted", label: "Trusted" },
};

/**
 * Size configurations
 */
const sizeConfig = {
  xs: { icon: "h-3 w-3", text: "text-[10px]", gap: "gap-0.5", padding: "px-1 py-0.5" },
  sm: { icon: "h-3.5 w-3.5", text: "text-xs", gap: "gap-1", padding: "px-1.5 py-0.5" },
  md: { icon: "h-4 w-4", text: "text-sm", gap: "gap-1", padding: "px-2 py-1" },
  lg: { icon: "h-5 w-5", text: "text-sm", gap: "gap-1.5", padding: "px-2.5 py-1" },
};

function pickFirst(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeIconType(value) {
  return String(value || "").trim().toLowerCase();
}

function hexToRgba(hex, alpha) {
  const cleaned = String(hex || "").trim();
  const match = cleaned.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }
  const intVal = Number.parseInt(value, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderBadgeIcon(config, iconClassName) {
  if (config.iconUrl) {
    return (
      <img
        src={config.iconUrl}
        alt=""
        aria-hidden="true"
        className={clsx(iconClassName, "shrink-0 object-contain")}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const IconComponent = BadgeIcons[config.icon] || BadgeIcons.default;
  return <IconComponent className={clsx(iconClassName, "shrink-0")} />;
}

function getBadgeTone(config) {
  const color = config?.color || "#6366f1";
  return {
    color,
    borderColor: hexToRgba(color, 0.3) || "var(--border)",
    backgroundColor: hexToRgba(color, 0.07) || "var(--secondary)",
  };
}

/**
 * Get badge configuration from badge object or type
 */
function getBadgeConfig(badge, type) {
  const normalizedType = normalizeIconType(type);
  if (normalizedType && BadgePresets[normalizedType]) {
    return { ...BadgePresets[normalizedType], iconUrl: undefined };
  }

  if (badge) {
    const iconType = normalizeIconType(
      pickFirst(badge.icon_type, badge.iconType, badge.slug, badge.Slug)
    );
    const iconUrl = pickFirst(badge.icon_url, badge.iconUrl, badge.IconURL);
    const preset = BadgePresets[iconType];
    const color = pickFirst(badge.color, badge.Color, preset?.color, "#6366f1");
    const label = pickFirst(badge.name, badge.Name, badge.label, preset?.label, "Badge");

    if (preset) {
      return {
        color,
        icon: preset.icon,
        label,
        iconUrl,
      };
    }

    if (BadgeIcons[iconType]) {
      return {
        color,
        icon: iconType,
        label,
        iconUrl,
      };
    }

    return {
      color,
      icon: iconType || "default",
      label,
      iconUrl,
    };
  }

  return { color: "#6366f1", icon: "default", label: "Badge", iconUrl: undefined };
}

/**
 * Badge Component - Main badge display
 * Styled like prompts.chat verified badge
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
          "inline-flex items-center rounded-full border font-medium animate-pulse-subtle",
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
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: config.color }}></span>
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: config.color }}></span>
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
          className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-current/10 transition-all active:scale-90"
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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
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
      {primaryBadge && !verified && !isAdmin && (
        <Badge badge={primaryBadge} size={size} />
      )}
    </span>
  );

  if (linkToProfile && username) {
    return (
      <Link
        href={`/user/${username}`}
        className="hover:underline transition-colors"
      >
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
