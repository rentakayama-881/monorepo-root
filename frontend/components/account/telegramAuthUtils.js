export const TELEGRAM_WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";
export const TELEGRAM_WIDGET_HANDLER = "__aivalidTelegramLoginHandler";

export function normalizeBotUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

export function isTelegramWidgetIframe(iframe) {
  if (!iframe) return false;
  const src = String(iframe.getAttribute("src") || iframe.src || "").toLowerCase();
  const id = String(iframe.id || "").toLowerCase();
  const className = typeof iframe.className === "string" ? iframe.className.toLowerCase() : "";
  return (
    src.includes("oauth.telegram.org/embed") ||
    src.includes("telegram.org/embed") ||
    id.includes("telegram-login") ||
    className.includes("telegram-login")
  );
}

export function iframeMatchesBot(iframe, botUsername) {
  const normalizedBot = normalizeBotUsername(botUsername);
  if (!normalizedBot) return true;
  const src = String(iframe?.getAttribute("src") || iframe?.src || "").toLowerCase();
  const id = String(iframe?.id || "").toLowerCase();
  const className = typeof iframe?.className === "string" ? iframe.className.toLowerCase() : "";
  return (
    src.includes(`/embed/${normalizedBot}`) ||
    id.includes(normalizedBot) ||
    className.includes(normalizedBot)
  );
}

export function cleanupTelegramWidgetArtifacts({ container, sectionRoot, botUsername }) {
  if (container) {
    container.innerHTML = "";
  }

  if (!sectionRoot || typeof document === "undefined") {
    return;
  }

  sectionRoot.querySelectorAll('script[src*="telegram-widget.js"]').forEach((scriptNode) => {
    scriptNode.remove();
  });

  sectionRoot.querySelectorAll("iframe").forEach((iframe) => {
    if (isTelegramWidgetIframe(iframe)) {
      iframe.remove();
    }
  });

  const normalizedBot = normalizeBotUsername(botUsername);
  if (!normalizedBot) {
    return;
  }

  document.body.querySelectorAll("script[src*='telegram-widget.js']").forEach((scriptNode) => {
    if (sectionRoot.contains(scriptNode)) {
      scriptNode.remove();
      return;
    }

    const scriptBot = normalizeBotUsername(scriptNode.getAttribute("data-telegram-login"));
    if (!normalizedBot || scriptBot === normalizedBot) {
      scriptNode.remove();
    }
  });

  document.body.querySelectorAll("iframe").forEach((iframe) => {
    if (sectionRoot.contains(iframe)) return;
    if (!isTelegramWidgetIframe(iframe)) return;
    if (!iframeMatchesBot(iframe, normalizedBot)) return;
    iframe.remove();
  });
}

export function formatVerifiedAt(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizeTelegramAuth(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    connected: Boolean(source.connected),
    telegram_user_id: String(source.telegram_user_id || ""),
    username: String(source.username || ""),
    display_username: String(source.display_username || ""),
    deep_link: String(source.deep_link || ""),
    verified_at: String(source.verified_at || ""),
    first_name: String(source.first_name || ""),
    last_name: String(source.last_name || ""),
    photo_url: String(source.photo_url || ""),
  };
}
