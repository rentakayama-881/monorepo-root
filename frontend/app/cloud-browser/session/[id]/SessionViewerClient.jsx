"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSessionStatus, usePricing, useAuthToken, getBrowserBase } from "../../useCloudBrowser";
import { stopSession } from "@/lib/browserApi";
import SessionToolbar from "./SessionToolbar";
import dynamic from "next/dynamic";
import { Keyboard, KeyboardOff } from "lucide-react";

const WebRTCViewer = dynamic(() => import("./WebRTCViewer"), { ssr: false });

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL_MS = 3000;

// X11 keysyms for mobile keyboard → VNC fallback
const KEY_TO_KEYSYM = {
  Backspace: 0xff08, Tab: 0xff09, Enter: 0xff0d, Escape: 0xff1b,
  ArrowLeft: 0xff51, ArrowUp: 0xff52, ArrowRight: 0xff53, ArrowDown: 0xff54,
  Delete: 0xffff, Home: 0xff50, End: 0xff57,
};

export default function SessionViewerClient() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id;
  const token = useAuthToken();

  const { session, isLoading, error } = useSessionStatus(sessionId);
  const { pricing } = usePricing();

  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const reconnectCountRef = useRef(0);
  const rfbRef = useRef(null);
  const containerRef = useRef(null);
  const kbInputRef = useRef(null);

  const isTouchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  // Determine stream mode from session data
  const streamMode = session?.stream_mode || "vnc";
  const vncWsUrl = session?.vnc_ws_url ?? null;

  // ── VNC mode: connect via noVNC RFB ──
  useEffect(() => {
    if (streamMode !== "vnc" || !vncWsUrl || !containerRef.current) return;

    let rfb = null;
    let destroyed = false;

    async function connect() {
      const { default: RFB } = await import("@novnc/novnc/lib/rfb");
      if (destroyed) return;
      if (containerRef.current) containerRef.current.innerHTML = "";

      try {
        rfb = new RFB(containerRef.current, vncWsUrl, { wsProtocols: ["binary"] });
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.showDotCursor = true;
        rfb.clipViewport = true;
        rfb.qualityLevel = 6;
        rfb.compressionLevel = 2;

        rfb.addEventListener("connect", () => {
          if (!destroyed) { reconnectCountRef.current = 0; setConnectionStatus("connected"); }
        });
        rfb.addEventListener("disconnect", (e) => {
          if (destroyed) return;
          if (e.detail.clean) { setConnectionStatus("disconnected"); return; }
          if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) { setConnectionStatus("failed"); return; }
          reconnectCountRef.current += 1;
          setConnectionStatus("reconnecting");
          setTimeout(() => { if (!destroyed) connect(); }, RECONNECT_INTERVAL_MS);
        });
        rfb.addEventListener("credentialsrequired", () => { if (rfb) rfb.sendCredentials({ password: "" }); });
        rfbRef.current = rfb;
      } catch (_err) {
        if (!destroyed) setConnectionStatus("failed");
      }
    }

    connect();
    return () => {
      destroyed = true;
      if (rfbRef.current) { try { rfbRef.current.disconnect(); } catch {} rfbRef.current = null; }
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [streamMode, vncWsUrl]);

  // ── WebRTC mode callbacks ──
  const onWebRTCConnected = useCallback(() => setConnectionStatus("connected"), []);
  const onWebRTCDisconnected = useCallback(() => setConnectionStatus("disconnected"), []);
  const onWebRTCFailed = useCallback(() => setConnectionStatus("failed"), []);

  // Auto-redirect when session is stopped
  useEffect(() => {
    if (!isLoading && session && session.status === "stopped") {
      const timer = setTimeout(() => router.replace("/cloud-browser"), 2000);
      return () => clearTimeout(timer);
    }
  }, [session, isLoading, router]);

  // Redirect on failed connection
  useEffect(() => {
    if (connectionStatus === "failed") {
      const timer = setTimeout(() => router.replace("/cloud-browser"), 3000);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, router]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    if (!confirm("Hentikan sesi browser ini? Sesi tidak dapat dilanjutkan setelah dihentikan.")) return;
    setStopping(true);
    setStopError(null);
    try {
      await stopSession(sessionId);
      if (rfbRef.current) { try { rfbRef.current.disconnect(); } catch {} rfbRef.current = null; }
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

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Exit fullscreen on unmount
  useEffect(() => {
    return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  }, []);

  // beforeunload warning
  useEffect(() => {
    if (!session || session.status !== "running") return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session]);

  // ── Mobile keyboard for VNC mode ──
  const handleKbInput = useCallback((e) => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    const inputType = e.nativeEvent?.inputType || "";
    if (inputType === "deleteContentBackward") { rfb.sendKey(KEY_TO_KEYSYM.Backspace); }
    else if (inputType === "insertLineBreak") { rfb.sendKey(KEY_TO_KEYSYM.Enter); }
    else { const text = e.nativeEvent?.data; if (text) { for (const ch of text) rfb.sendKey(ch.codePointAt(0)); } }
    if (kbInputRef.current) kbInputRef.current.value = "";
  }, []);

  const handleKbKeyDown = useCallback((e) => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    const sym = KEY_TO_KEYSYM[e.key];
    if (sym) { e.preventDefault(); rfb.sendKey(sym); }
  }, []);

  const toggleKeyboard = useCallback(() => {
    setShowKeyboard((prev) => {
      const next = !prev;
      if (next) setTimeout(() => kbInputRef.current?.focus(), 50);
      else kbInputRef.current?.blur();
      return next;
    });
  }, []);

  // ── Render states ──
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

  if (error) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">{error.message || "Gagal memuat sesi browser."}</p>
          <button type="button" onClick={() => router.replace("/cloud-browser")}
            className="rounded-[var(--radius)] bg-muted px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/80">
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (session?.status === "stopped") {
    return (
      <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Sesi telah berakhir. Mengalihkan ke dashboard...</p>
          <div className="size-6 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", isFullscreen ? "h-screen" : "h-[calc(100vh-var(--header-height))]")}>
      <SessionToolbar
        session={session} pricing={pricing} onStop={handleStop}
        onToggleFullscreen={toggleFullscreen}
        onToggleKeyboard={isTouchDevice && streamMode === "vnc" ? toggleKeyboard : null}
        isFullscreen={isFullscreen} showKeyboard={showKeyboard} stopping={stopping}
      />

      {stopError ? (
        <div className="bg-destructive/10 px-4 py-2 text-xs text-destructive text-center">{stopError}</div>
      ) : null}

      {connectionStatus === "reconnecting" ? (
        <div className="bg-amber-500/90 px-4 py-2 text-xs text-white text-center flex items-center justify-center gap-2">
          <div className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
          Koneksi terputus, menghubungkan kembali... ({reconnectCountRef.current}/{MAX_RECONNECT_ATTEMPTS})
        </div>
      ) : null}
      {connectionStatus === "failed" ? (
        <div className="bg-destructive/90 px-4 py-2 text-xs text-white text-center">
          Koneksi gagal. Mengalihkan ke dashboard...
        </div>
      ) : null}

      {/* Viewer area */}
      <div className="flex-1 bg-black relative overflow-hidden touch-none">
        {streamMode === "webrtc" ? (
          <WebRTCViewer
            sessionId={sessionId}
            apiBase={getBrowserBase()}
            token={token}
            onConnected={onWebRTCConnected}
            onDisconnected={onWebRTCDisconnected}
            onFailed={onWebRTCFailed}
          />
        ) : vncWsUrl ? (
          <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <div className="size-8 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-sm text-muted-foreground">Menunggu koneksi ke browser...</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden input for VNC mobile keyboard */}
      {isTouchDevice && streamMode === "vnc" ? (
        <input ref={kbInputRef} type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off"
          spellCheck={false} className="fixed -left-[9999px] top-0 opacity-0 w-0 h-0"
          aria-label="Keyboard input" onInput={handleKbInput} onKeyDown={handleKbKeyDown} />
      ) : null}

      {/* Mobile keyboard FAB — VNC mode only */}
      {isTouchDevice && streamMode === "vnc" && connectionStatus === "connected" ? (
        <button type="button" onClick={toggleKeyboard}
          className={cn("fixed bottom-4 right-4 z-50 flex items-center justify-center",
            "size-12 rounded-full shadow-lg transition-all active:scale-95",
            showKeyboard ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border")}
          aria-label={showKeyboard ? "Sembunyikan keyboard" : "Tampilkan keyboard"}>
          {showKeyboard ? <KeyboardOff className="size-5" /> : <Keyboard className="size-5" />}
        </button>
      ) : null}
    </div>
  );
}
