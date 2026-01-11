"use client";

import { resolveAvatarSrc, getInitials, getAvatarColor } from "@/lib/avatar";

/**
 * Avatar component that shows image or initials
 * @param {Object} props
 * @param {string} props.src - Avatar URL (can be null)
 * @param {string} props.name - Name/username for initials fallback
 * @param {string} props.size - Size: "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" (default: "md")
 * @param {string} props.className - Additional classes
 */
export default function Avatar({ src, name, size = "md", className = "" }) {
  const avatarUrl = resolveAvatarSrc(src);
  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);

  const sizes = {
    xxs: "h-5 w-5 text-[9px]",      // 20px - untuk inline mentions
    xs: "h-6 w-6 text-[10px]",       // 24px - untuk header, thread list
    sm: "h-8 w-8 text-xs",           // 32px - untuk comments
    md: "h-10 w-10 text-sm",         // 40px - default
    lg: "h-16 w-16 text-lg",         // 64px - untuk cards
    xl: "h-20 w-20 text-xl",         // 80px - untuk profile preview
    "2xl": "h-64 w-64 text-5xl",     // 256px - untuk profile page (GitHub style)
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
