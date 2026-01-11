"use client";

import { cn } from "@/lib/utils";
import { resolveAvatarSrc, getInitials, getAvatarColor } from "@/lib/avatar";
import { useState } from "react";

/**
 * Avatar component that shows image or initials
 * @param {Object} props
 * @param {string} props.src - Avatar URL (can be null)
 * @param {string} props.name - Name/username for initials fallback
 * @param {string} props.size - Size: "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" (default: "md")
 * @param {string} props.status - Status indicator: "online" | "offline" | "away" | null
 * @param {boolean} props.showStatus - Show status indicator (default: false)
 * @param {string} props.className - Additional classes
 */
export default function Avatar({ 
  src, 
  name, 
  size = "md", 
  status = null,
  showStatus = false,
  className = "" 
}) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
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
    "2xl": "h-64 w-64 text-5xl",     // 256px - untuk profile page
  };

  const statusSizes = {
    xxs: "h-1.5 w-1.5 ring-1",
    xs: "h-2 w-2 ring-1",
    sm: "h-2.5 w-2.5 ring-2",
    md: "h-3 w-3 ring-2",
    lg: "h-4 w-4 ring-2",
    xl: "h-5 w-5 ring-2",
    "2xl": "h-12 w-12 ring-4",
  };

  const statusColors = {
    online: "bg-success",
    offline: "bg-muted-foreground",
    away: "bg-warning",
  };

  const sizeClass = sizes[size] || sizes.md;
  const statusSizeClass = statusSizes[size] || statusSizes.md;

  const avatarContent = avatarUrl && !imageError ? (
    <div className="relative">
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-secondary animate-pulse",
            sizeClass
          )}
        />
      )}
      <img
        src={avatarUrl}
        alt={name || "Avatar"}
        className={cn(
          "rounded-full border bg-secondary object-cover",
          sizeClass,
          isLoading && "opacity-0",
          className
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true);
          setIsLoading(false);
        }}
      />
    </div>
  ) : (
    // Show initials with colored background
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-white select-none",
        sizeClass,
        className
      )}
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      {initials}
    </div>
  );

  // Wrap in container for status indicator
  if (showStatus && status) {
    return (
      <div className="relative inline-block">
        {avatarContent}
        <span 
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-background",
            statusSizeClass,
            statusColors[status] || statusColors.offline
          )}
          aria-label={status}
        />
      </div>
    );
  }

  return avatarContent;
}

/**
 * AvatarGroup - Display multiple avatars stacked
 */
export function AvatarGroup({ avatars = [], max = 5, size = "sm", className = "" }) {
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {displayAvatars.map((avatar, index) => (
        <div
          key={index}
          className="relative ring-2 ring-background rounded-full"
          style={{ zIndex: max - index }}
        >
          <Avatar
            src={avatar.src || avatar.avatar_url}
            name={avatar.name || avatar.username}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-secondary text-muted-foreground font-semibold ring-2 ring-background",
            size === "xs" && "h-6 w-6 text-[10px]",
            size === "sm" && "h-8 w-8 text-xs",
            size === "md" && "h-10 w-10 text-sm",
            size === "lg" && "h-16 w-16 text-lg"
          )}
          title={`+${remaining} lainnya`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
