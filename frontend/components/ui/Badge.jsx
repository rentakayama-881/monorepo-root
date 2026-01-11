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

// Badge icon components (SVG-based, no PNG dependency)
const BadgeIcons = {
  verified: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  admin: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
    </svg>
  ),
  moderator: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
  ),
  contributor: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M14.447 3.027a.75.75 0 01.527.92l-4.5 16.5a.75.75 0 01-1.448-.394l4.5-16.5a.75.75 0 01.921-.526zM16.72 6.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 010-1.06zm-9.44 0a.75.75 0 010 1.06L2.56 12l4.72 4.72a.75.75 0 11-1.06 1.06L.97 12.53a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clipRule="evenodd" />
    </svg>
  ),
  premium: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  checkmark: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  ),
  trusted: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  ),
  default: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
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

/**
 * Get badge configuration from badge object or type
 */
function getBadgeConfig(badge, type) {
  if (type && BadgePresets[type]) {
    return BadgePresets[type];
  }
  
  if (badge) {
    // Map slug to preset if available
    const slug = badge.slug || badge.icon_type || "";
    if (BadgePresets[slug]) {
      return { ...BadgePresets[slug], label: badge.name || BadgePresets[slug].label };
    }
    
    // Custom badge from database
    return {
      color: badge.color || "#6366f1",
      icon: slug || "default",
      label: badge.name || "Badge",
    };
  }
  
  return { color: "#6366f1", icon: "default", label: "Badge" };
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
  const IconComponent = BadgeIcons[config.icon] || BadgeIcons.default;

  // Pulse variant (animated for notifications)
  if (variant === "pulse") {
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-full font-medium animate-pulse-subtle",
          sizes.gap,
          sizes.text,
          sizes.padding,
          className
        )}
        style={{
          backgroundColor: `${config.color}15`,
          color: config.color,
        }}
        title={config.label}
        {...props}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: config.color }}></span>
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: config.color }}></span>
        </span>
        <IconComponent className={sizes.icon} />
        {(showLabel || variant === "pulse") && <span>{config.label}</span>}
      </span>
    );
  }

  // Icon-only variant (inline with username)
  if (variant === "icon") {
    return (
      <span
        className={clsx("inline-flex items-center shrink-0", className)}
        style={{ color: config.color }}
        title={config.label}
        {...props}
      >
        <IconComponent className={sizes.icon} />
      </span>
    );
  }

  // Inline variant (icon + label, no background)
  if (variant === "inline") {
    return (
      <span
        className={clsx("inline-flex items-center font-medium", sizes.gap, sizes.text, className)}
        style={{ color: config.color }}
        title={config.label}
        {...props}
      >
        <IconComponent className={sizes.icon} />
        {showLabel && <span>{config.label}</span>}
      </span>
    );
  }

  // Chip variant (with background)
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium",
        sizes.gap,
        sizes.text,
        sizes.padding,
        className
      )}
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
      title={config.label}
      {...props}
    >
      <IconComponent className={sizes.icon} />
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
  const IconComponent = BadgeIcons[config.icon] || BadgeIcons.default;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium transition-all",
        "hover:shadow-sm",
        sizes.gap,
        sizes.text,
        sizes.padding,
        className
      )}
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
      title={badge.description || badge.name}
    >
      <IconComponent className={sizes.icon} />
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
    const Link = require("next/link").default;
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
