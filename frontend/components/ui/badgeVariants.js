/**
 * Badge System — variant definitions, icons, and utility functions.
 */

import clsx from "clsx";
import Image from "next/image";

// Badge icon components (outline style, GitHub-like)
export const BadgeIcons = {
  verified: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  admin: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  moderator: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  ),
  contributor: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
  ),
  premium: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  ),
  checkmark: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  trusted: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  default: (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    </svg>
  ),
};

// Preset badge types with colors
export const BadgePresets = {
  verified: { color: "#3b82f6", icon: "checkmark", label: "Verified" },
  admin: { color: "#ef4444", icon: "admin", label: "Admin" },
  moderator: { color: "#f59e0b", icon: "moderator", label: "Moderator" },
  contributor: { color: "#8b5cf6", icon: "contributor", label: "Contributor" },
  premium: { color: "#eab308", icon: "premium", label: "Premium" },
  trusted: { color: "#22c55e", icon: "trusted", label: "Trusted" },
};

// Size configurations
export const sizeConfig = {
  xs: { icon: "h-3 w-3", text: "text-[10px]", gap: "gap-0.5", padding: "px-1 py-0.5" },
  sm: { icon: "h-3.5 w-3.5", text: "text-xs", gap: "gap-1", padding: "px-1.5 py-0.5" },
  md: { icon: "h-4 w-4", text: "text-sm", gap: "gap-1", padding: "px-2 py-1" },
  lg: { icon: "h-5 w-5", text: "text-sm", gap: "gap-1.5", padding: "px-2.5 py-1" },
};

export function pickFirst(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

export function normalizeIconType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function hexToRgba(hex, alpha) {
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

export function renderBadgeIcon(config, iconClassName) {
  if (config.iconUrl) {
    return (
      <Image
        src={config.iconUrl}
        alt=""
        aria-hidden="true"
        width={16}
        height={16}
        className={clsx(iconClassName, "shrink-0 object-contain")}
        loading="lazy"
        unoptimized
      />
    );
  }

  const IconComponent = BadgeIcons[config.icon] || BadgeIcons.default;
  return <IconComponent className={clsx(iconClassName, "shrink-0")} />;
}

export function getBadgeTone(config) {
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
export function getBadgeConfig(badge, type) {
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
