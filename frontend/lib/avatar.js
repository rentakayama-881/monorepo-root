import { getApiBase } from "./api";

/**
 * Resolve avatar URL to a full URL
 * Returns null if no avatar (use initials instead)
 */
export function resolveAvatarSrc(avatarUrl) {
  if (!avatarUrl) return null;

  const lower = String(avatarUrl);
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return lower;
  }

  if (lower.startsWith("/")) {
    return `${getApiBase()}${lower}`;
  }

  return `${getApiBase()}/static/avatars/${lower}`;
}

/**
 * Get initials from a name or username (max 2 characters)
 */
export function getInitials(name) {
  if (name == null) return "";
  const cleaned = String(name).trim();
  if (!cleaned) return "";
  
  // Split by space to get first letters of each word
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  // If single word, take first 2 characters
  return cleaned.substring(0, 2).toUpperCase();
}

/**
 * Generate a consistent color based on string (for avatar background)
 */
export function getAvatarColor(str) {
  if (!str) return "hsl(220, 50%, 50%)";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 50%)`;
}
