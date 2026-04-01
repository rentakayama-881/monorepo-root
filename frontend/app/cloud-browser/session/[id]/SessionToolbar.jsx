"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Maximize, Minimize, Square, ArrowLeft, Clock, Wallet, Keyboard, KeyboardOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/swr";

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "Rp 0";
  return `Rp ${Math.floor(amount).toLocaleString("id-ID")}`;
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SessionToolbar({
  session,
  pricing,
  onStop,
  onToggleFullscreen,
  onToggleKeyboard,
  isFullscreen,
  showKeyboard,
  stopping,
}) {
  const router = useRouter();
  const { wallet } = useWallet();

  const balance = wallet?.data?.balance ?? wallet?.balance ?? 0;
  const pricePerMinute =
    pricing?.pricePerMinute ??
    pricing?.price_per_minute ??
    Math.ceil((pricing?.pricePerHourIdr ?? pricing?.price_per_hour ?? 10000) / 60);

  // Timer: elapsed seconds since session started
  const [elapsed, setElapsed] = useState(0);

  const sessionStartedAt = session?.started_at;
  const startedAt = useMemo(() => {
    if (!sessionStartedAt) return null;
    const d = new Date(sessionStartedAt);
    return isNaN(d.getTime()) ? null : d;
  }, [sessionStartedAt]);

  useEffect(() => {
    if (!startedAt) return;

    const tick = () => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - startedAt.getTime()) / 1000)));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  // Running cost = elapsed minutes * price per minute
  const elapsedMinutes = Math.ceil(elapsed / 60);
  const runningCost = elapsedMinutes * pricePerMinute;

  const profileName = session?.profile_name || session?.profile?.name || "Sesi Browser";

  return (
    <div
      className={cn(
        "flex items-center gap-1 sm:gap-x-4 sm:gap-y-1.5 border-b bg-card px-2 sm:px-4 py-1.5 sm:py-2",
        "text-[10px] sm:text-xs",
        "flex-nowrap overflow-x-auto scrollbar-none"
      )}
    >
      {/* Back + Profile name */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            }
            router.push("/cloud-browser");
          }}
          className="rounded-[var(--radius)] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Kembali ke dashboard"
        >
          <ArrowLeft className="size-3.5 sm:size-4" />
        </button>
        <span className="font-semibold text-foreground truncate max-w-[80px] sm:max-w-[200px]">
          {profileName}
        </span>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-0.5 sm:gap-1 text-muted-foreground shrink-0">
        <Clock className="size-2.5 sm:size-3" aria-hidden="true" />
        <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
      </div>

      {/* Running cost — always visible, compact on mobile */}
      <div className="flex items-center gap-0.5 sm:gap-1 text-muted-foreground shrink-0">
        <span className="font-semibold text-foreground text-[10px] sm:text-xs">{formatCurrency(runningCost)}</span>
      </div>

      {/* Remaining balance — compact on mobile, full on desktop */}
      <div className="flex items-center gap-0.5 sm:gap-1 text-muted-foreground shrink-0">
        <Wallet className="size-2.5 sm:size-3" aria-hidden="true" />
        <span className="hidden sm:inline">Sisa:</span>
        <span className="font-medium text-foreground text-[10px] sm:text-xs">{formatCurrency(balance - runningCost)}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Keyboard toggle — mobile only */}
        {onToggleKeyboard ? (
          <button
            type="button"
            onClick={onToggleKeyboard}
            className={cn(
              "rounded-[var(--radius)] p-1 sm:p-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              showKeyboard
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label={showKeyboard ? "Sembunyikan keyboard" : "Tampilkan keyboard"}
          >
            {showKeyboard
              ? <KeyboardOff className="size-3.5" />
              : <Keyboard className="size-3.5" />
            }
          </button>
        ) : null}

        {/* Fullscreen */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="rounded-[var(--radius)] p-1 sm:p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
        >
          {isFullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
        </button>

        {/* Stop */}
        <button
          type="button"
          onClick={onStop}
          disabled={stopping}
          className="inline-flex items-center gap-0.5 sm:gap-1 rounded-[var(--radius)] bg-destructive/10 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Square className="size-2.5 sm:size-3" aria-hidden="true" />
          <span className="hidden sm:inline">{stopping ? "Menghentikan..." : "Hentikan Sesi"}</span>
          <span className="sm:hidden">{stopping ? "..." : "Stop"}</span>
        </button>
      </div>
    </div>
  );
}
