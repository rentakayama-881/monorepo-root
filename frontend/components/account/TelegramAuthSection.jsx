"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { fetchJsonAuth } from "@/lib/api";
import {
  TELEGRAM_WIDGET_SRC,
  TELEGRAM_WIDGET_HANDLER,
  normalizeBotUsername,
  cleanupTelegramWidgetArtifacts,
  formatVerifiedAt,
  normalizeTelegramAuth,
} from "./telegramAuthUtils";

export default function TelegramAuthSection({ telegramAuth, onTelegramAuthChange }) {
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sectionRef = useRef(null);
  const widgetContainerRef = useRef(null);

  const botUsername = useMemo(
    () =>
      String(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "")
        .trim()
        .replace(/^@/, ""),
    []
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
        container,
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Status</div>
            <div
              className={`text-sm ${connected ? "text-status-success-text" : "text-status-amber-text"}`}
            >
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
          Kontak Telegram untuk case validasi diambil dari akun Telegram yang sudah diverifikasi.
        </div>

        {connected ? (
          <div className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Akun</div>
              <div>{displayName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Telegram User ID
              </div>
              <div>{currentAuth.telegram_user_id || "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Verified At
              </div>
              <div>{formatVerifiedAt(currentAuth.verified_at)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Contact Link
              </div>
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
              Setelah login Telegram berhasil, sistem akan memverifikasi signature resmi dari
              Telegram.
            </div>
          </div>
        )}

        {error ? <Alert variant="error" message={error} compact /> : null}
        {message ? <Alert variant="success" message={message} compact /> : null}
      </div>
    </section>
  );
}
