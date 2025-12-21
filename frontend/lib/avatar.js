import { getApiBase } from "./api";

export function resolveAvatarSrc(avatarUrl) {
  if (!avatarUrl) return "/avatar-default.png";

  const lower = String(avatarUrl);
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return lower;
  }

  if (lower.startsWith("/")) {
    return `${getApiBase()}${lower}`;
  }

  return `${getApiBase()}/static/avatars/${lower}`;
}
