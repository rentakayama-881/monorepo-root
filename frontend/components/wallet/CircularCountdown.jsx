import { cn } from "@/lib/utils";

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(seconds) {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getPhase(seconds, totalSeconds) {
  if (seconds <= 0) return "expired";
  const ratio = seconds / totalSeconds;
  if (ratio <= 0.15) return "critical";
  if (ratio <= 0.35) return "warning";
  return "normal";
}

const PHASE_COLORS = {
  normal: {
    stroke: "oklch(0.65 0.15 160)",
    glow: "oklch(0.65 0.15 160 / 0.35)",
    text: "text-foreground",
  },
  warning: {
    stroke: "oklch(0.75 0.15 85)",
    glow: "oklch(0.75 0.15 85 / 0.35)",
    text: "text-warning-foreground",
  },
  critical: {
    stroke: "oklch(0.55 0.2 25)",
    glow: "oklch(0.55 0.2 25 / 0.4)",
    text: "text-destructive",
  },
  expired: {
    stroke: "oklch(0.45 0.03 260)",
    glow: "transparent",
    text: "text-muted-foreground",
  },
};

/**
 * Circular countdown timer with SVG ring progress and ambient glow.
 *
 * @param {number} seconds - remaining seconds
 * @param {number} totalSeconds - total seconds for the full ring
 * @param {string} [className]
 */
export default function CircularCountdown({ seconds, totalSeconds, className }) {
  const progress = totalSeconds > 0 ? Math.max(0, seconds / totalSeconds) : 0;
  const offset = CIRCUMFERENCE * (1 - progress);
  const phase = getPhase(seconds, totalSeconds);
  const colors = PHASE_COLORS[phase];

  return (
    <div
      className={cn("relative flex flex-col items-center gap-2", className)}
      role="timer"
      aria-live="polite"
      aria-label={`Sisa waktu: ${formatTime(seconds)}`}
    >
      <div className="relative">
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          className="drop-shadow-sm"
          style={{
            filter: phase !== "expired" ? `drop-shadow(0 0 8px ${colors.glow})` : undefined,
          }}
        >
          {/* Background track */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="5"
            strokeOpacity="0.5"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className={cn(
              "origin-center -rotate-90 transition-[stroke-dashoffset] duration-1000 ease-linear",
              phase === "critical" && "animate-[pulse-ring_2s_ease-in-out_infinite]"
            )}
            style={{ transformOrigin: "50% 50%" }}
          />
        </svg>
        {/* Center time readout */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn("text-2xl font-mono font-bold tracking-wide tabular-nums", colors.text)}
          >
            {formatTime(seconds)}
          </span>
        </div>
      </div>

      {/* Label below */}
      <span className="text-xs text-muted-foreground">
        {phase === "expired" ? "Waktu habis" : "Sisa waktu pembayaran"}
      </span>
    </div>
  );
}
