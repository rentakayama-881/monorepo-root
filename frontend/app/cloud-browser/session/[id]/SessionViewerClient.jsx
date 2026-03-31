"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSessionStatus, usePricing } from "../../useCloudBrowser";
import { stopSession } from "@/lib/browserApi";
import SessionToolbar from "./SessionToolbar";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL_MS = 3000;

export default function SessionViewerClient() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id;

  const { session, isLoading, error } = useSessionStatus(sessionId);
  const { pricing } = usePricing();

  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const reconnectCountRef = useRef(0);
  const rfbRef = useRef(null);
  const containerRef = useRef(null);

  // Extract WebSocket URL from session data
  const vncWsUrl = session?.vnc_ws_url ?? null;

  // Connect to VNC via @novnc/novnc RFB
  useEffect(() => {
    if (!vncWsUrl || !containerRef.current) return;

    let rfb = null;
    let destroyed = false;

    async function connect() {
      // Dynamic import — @novnc/novnc requires browser globals (window, document)
      const { default: RFB } = await import("@novnc/novnc/lib/rfb");

      if (destroyed) return;

      try {
        rfb = new RFB(containerRef.current, vncWsUrl, {
          wsProtocols: ["binary"],
        });
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.showDotCursor = true;

        rfb.addEventListener("connect", () => {
          if (!destroyed) {
            reconnectCountRef.current = 0;
            setConnectionStatus("connected");
          }
        });

        rfb.addEventListener("disconnect", (e) => {
          if (destroyed) return;
          if (e.detail.clean) {
            setConnectionStatus("disconnected");
            return;
          }
          // Unclean disconnect — try to reconnect
          if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus("failed");
            return;
          }
          reconnectCountRef.current += 1;
          setConnectionStatus("reconnecting");
          setTimeout(() => {
            if (!destroyed) connect();
          }, RECONNECT_INTERVAL_MS);
        });

        rfb.addEventListener("credentialsrequired", () => {
          // No password set on x11vnc (-nopw)
          if (rfb) rfb.sendCredentials({ password: "" });
        });

        rfbRef.current = rfb;
      } catch (err) {
        if (!destroyed) setConnectionStatus("failed");
      }
    }

    connect();

    return () => {
      destroyed = true;
      if (rfbRef.current) {
        try { rfbRef.current.disconnect(); } catch {}
        rfbRef.current = null;
      }
    };
  }, [vncWsUrl]);

  // Auto-redirect when session is stopped
  useEffect(() => {
    if (!isLoading && session && session.status === "stopped") {
      const timer = setTimeout(() => {
        router.replace("/cloud-browser");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [session, isLoading, router]);

  // Redirect to dashboard if reconnection fully failed
  useEffect(() => {
    if (connectionStatus === "failed") {
      const timer = setTimeout(() => {
        router.replace("/cloud-browser");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, router]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    if (!confirm("Hentikan sesi browser ini? Sesi tidak dapat dilanjutkan setelah dihentikan.")) {
      return;
    }

    setStopping(true);
    setStopError(null);
    try {
      await stopSession(sessionId);
      if (rfbRef.current) {
        try { rfbRef.current.disconnect(); } catch {}
        rfbRef.current = null;
      }
      router.replace("/cloud-browser");
    } catch (err) {
      setStopError(err?.message || "Gagal menghentikan sesi.");
    } finally {
      setStopping(false);
    }
  }, [sessionId, router]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Sync fullscreen state with browser
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Warn user when navigating away with active session
  useEffect(() => {
    if (!session || session.status !== "running") return;
    const handler = (e) => {
      e.preventDefault();
      // Modern browsers ignore custom messages; the standard prompt is shown
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session]);

  // Loading
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center">
        <div className="text-center space-y-2">
          <div className="size-8 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Memuat sesi browser...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">
            {error.message || "Gagal memuat sesi browser."}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/cloud-browser")}
            className="rounded-[var(--radius)] bg-muted px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Session stopped
  if (session?.status === "stopped") {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Sesi telah berakhir. Mengalihkan ke dashboard...
          </p>
          <div className="size-6 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        isFullscreen ? "h-screen" : "h-[calc(100vh-var(--header-height))]"
      )}
    >
      {/* Toolbar */}
      <SessionToolbar
        session={session}
        pricing={pricing}
        onStop={handleStop}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        stopping={stopping}
      />

      {/* Stop error */}
      {stopError ? (
        <div className="bg-destructive/10 px-4 py-2 text-xs text-destructive text-center">
          {stopError}
        </div>
      ) : null}

      {/* Connection status overlay */}
      {connectionStatus === "reconnecting" ? (
        <div className="bg-amber-500/90 px-4 py-2 text-xs text-white text-center flex items-center justify-center gap-2">
          <div className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
          Koneksi terputus, menghubungkan kembali... ({reconnectCountRef.current}/
          {MAX_RECONNECT_ATTEMPTS})
        </div>
      ) : null}
      {connectionStatus === "failed" ? (
        <div className="bg-destructive/90 px-4 py-2 text-xs text-white text-center">
          Koneksi gagal setelah {MAX_RECONNECT_ATTEMPTS} percobaan. Mengalihkan ke dashboard...
        </div>
      ) : null}

      {/* VNC Viewer — noVNC renders its canvas into this div */}
      <div className="flex-1 bg-black relative">
        {vncWsUrl ? (
          <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <div className="size-8 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-sm text-muted-foreground">Menunggu koneksi ke browser...</p>
              <p className="text-xs text-muted-foreground/60">
                Browser sedang disiapkan. Ini mungkin membutuhkan beberapa detik.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
