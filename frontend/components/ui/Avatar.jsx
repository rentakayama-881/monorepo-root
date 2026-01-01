"use client";

import { resolveAvatarSrc, getInitials, getAvatarColor } from "@/lib/avatar";

/**
 * Avatar component that shows image or initials
 * @param {Object} props
 * @param {string} props.src - Avatar URL (can be null)
 * @param {string} props.name - Name/username for initials fallback
 * @param {string} props.size - Size: "xs" | "sm" | "md" | "lg" | "xl" (default: "md")
 * @param {string} props.className - Additional classes
 */
export default function Avatar({ src, name, size = "md", className = "" }) {
  const avatarUrl = resolveAvatarSrc(src);
  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);

  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-lg",
    xl: "h-24 w-24 text-2xl",
  };

  const sizeClass = sizes[size] || sizes.md;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Avatar"}
        className={`rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] object-cover ${sizeClass} ${className}`}
      />
    );
  }

  // Show initials with colored background
  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white select-none ${sizeClass} ${className}`}
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      {initials}
    </div>
  );
}
