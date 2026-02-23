"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { fetchJsonAuth } from "@/lib/api";

const TELEGRAM_WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";
const TELEGRAM_WIDGET_HANDLER = "__aivalidTelegramLoginHandler";

function normalizeBotUsername(value) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function isTelegramWidgetIframe(iframe) {
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

function iframeMatchesBot(iframe, botUsername) {
  const normalizedBot = normalizeBotUsername(botUsername);
  if (!normalizedBot) return true;
  const src = String(iframe?.getAttribute("src") || iframe?.src || "").toLowerCase();
  const id = String(iframe?.id || "").toLowerCase();
  const className = typeof iframe?.className === "string" ? iframe.className.toLowerCase() : "";
  return src.includes(`/embed/${normalizedBot}`) || id.includes(normalizedBot) || className.includes(normalizedBot);
}

function cleanupTelegramWidgetArtifacts({ container, sectionRoot, botUsername }) {
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

function formatVerifiedAt(rawValue) {
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

function normalizeTelegramAuth(value) {
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

export default function TelegramAuthSection({ telegramAuth, onTelegramAuthChange }) {
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sectionRef = useRef(null);
  const widgetContainerRef = useRef(null);

  const botUsername = useMemo(
    () => String(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "").trim().replace(/^@/, ""),
    [],
  );

  const currentAuth = useMemo(() => normalizeTelegramAuth(telegramAuth), [telegramAuth]);
  const connected = currentAuth.connected;
  const displayName =
    currentAuth.display_username ||
    (currentAuth.telegram_user_id ? `ID: ${currentAuth.telegram_user_id}` : "Belum terhubung");

  useEffect(() => {
    window[TELEGRAM_WIDGET_HANDLER] = async (widgetUser) => {
      setLoadingConnect(true);
      setError("");
      setMessage("");
      try {
        const data = await fetchJsonAuth("/api/account/telegram/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(widgetUser || {}),
        });
        const next = normalizeTelegramAuth(data?.telegram_auth);
        if (typeof onTelegramAuthChange === "function") {
          onTelegramAuthChange(next);
        }
        cleanupTelegramWidgetArtifacts({
          container: widgetContainerRef.current,
          sectionRoot: sectionRef.current,
          botUsername,
        });
        setMessage("Akun Telegram berhasil terhubung.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menghubungkan Telegram.");
      } finally {
        setLoadingConnect(false);
      }
    };

    return () => {
      delete window[TELEGRAM_WIDGET_HANDLER];
    };
  }, [botUsername, onTelegramAuthChange]);

  useEffect(() => {
    const sectionRoot = sectionRef.current;
    const container = widgetContainerRef.current;
    if (!sectionRoot) return;

    cleanupTelegramWidgetArtifacts({ container, sectionRoot, botUsername });

    if (connected || !botUsername || !container) {
      return;
    }

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SRC;
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "small");
    script.setAttribute("data-radius", "1");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-lang", "en");
    script.setAttribute("data-onauth", `window.${TELEGRAM_WIDGET_HANDLER}(user)`);
    container.appendChild(script);

    return () => {
      cleanupTelegramWidgetArtifacts({
        container: widgetContainerRef.current,
        sectionRoot,
        botUsername,
      });
    };
  }, [botUsername, connected]);

  async function disconnectTelegram() {
    setLoadingDisconnect(true);
    setError("");
    setMessage("");
    try {
      const data = await fetchJsonAuth("/api/account/telegram/disconnect", {
        method: "POST",
      });
      const next = normalizeTelegramAuth(data?.telegram_auth);
      if (typeof onTelegramAuthChange === "function") {
        onTelegramAuthChange(next);
      }
      setMessage("Koneksi Telegram dilepas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal melepas koneksi Telegram.");
    } finally {
      setLoadingDisconnect(false);
    }
  }

  return (
    <section ref={sectionRef} className="settings-section">
      <h3 className="settings-section-title mb-3">Telegram Auth</h3>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Status</div>
            <div className={`text-sm ${connected ? "text-emerald-700" : "text-amber-700"}`}>
              {connected ? "Connected (Verified)" : "Belum terhubung"}
            </div>
          </div>
          {connected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={disconnectTelegram}
              loading={loadingDisconnect}
              disabled={loadingConnect}
            >
              Disconnect
            </Button>
          ) : null}
        </div>

        <div className="text-sm text-muted-foreground">
          Kontak Telegram untuk Validation Case diambil dari akun Telegram yang sudah diverifikasi.
        </div>

        {connected ? (
          <div className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Akun</div>
              <div>{displayName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Telegram User ID</div>
              <div>{currentAuth.telegram_user_id || "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Verified At</div>
              <div>{formatVerifiedAt(currentAuth.verified_at)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Contact Link</div>
              {currentAuth.deep_link ? (
                <a
                  href={currentAuth.deep_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {currentAuth.deep_link}
                </a>
              ) : (
                <span>-</span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {!botUsername ? (
              <Alert
                variant="warning"
                message="NEXT_PUBLIC_TELEGRAM_BOT_USERNAME belum di-set. Hubungi admin untuk mengaktifkan Telegram Auth."
                compact
              />
            ) : null}
            <div
              ref={widgetContainerRef}
              data-testid="telegram-widget-container"
              className="text-sm text-foreground [&_*]:!text-foreground"
            />
            <div className="text-xs text-muted-foreground">
              Setelah login Telegram berhasil, sistem akan memverifikasi signature resmi dari Telegram.
            </div>
          </div>
        )}

        {error ? <Alert variant="error" message={error} compact /> : null}
        {message ? <Alert variant="success" message={message} compact /> : null}
      </div>
    </section>
  );
}
