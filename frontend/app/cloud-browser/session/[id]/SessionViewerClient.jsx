"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSessionStatus, usePricing } from "../../useCloudBrowser";
import { stopSession } from "@/lib/browserApi";
import SessionToolbar from "./SessionToolbar";

export default function SessionViewerClient() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id;

  const { session, isLoading, error } = useSessionStatus(sessionId);
  const { pricing } = usePricing();

  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Determine VNC URL from session data
  const wsPort = session?.vnc_port || session?.ws_port;
  const browserBase = process.env.NEXT_PUBLIC_BROWSER_API_URL || "https://browser.aivalid.id";
  const vncUrl = wsPort
    ? `${browserBase}/vnc/?autoconnect=true&resize=scale&path=ws/${wsPort}`
    : null;

  // Auto-redirect when session is stopped
  useEffect(() => {
    if (!isLoading && session && session.status === "stopped") {
      const timer = setTimeout(() => {
        router.replace("/cloud-browser");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [session, isLoading, router]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    if (!confirm("Hentikan sesi browser ini? Sesi tidak dapat dilanjutkan setelah dihentikan.")) {
      return;
    }

    setStopping(true);
    setStopError(null);
    try {
      await stopSession(sessionId);
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

      {/* VNC Viewer */}
      <div className="flex-1 bg-black relative">
        {vncUrl ? (
          <iframe
            src={vncUrl}
            title="Browser Session"
            className="absolute inset-0 h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
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
