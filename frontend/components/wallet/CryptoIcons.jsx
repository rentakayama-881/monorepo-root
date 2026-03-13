import { cn } from "@/lib/utils";

/**
 * TON icon — gradient diamond with faceted look.
 * Uses linearGradient for a modern 3D diamond effect.
 */
export function TonIcon({ size = "h-8 w-8", className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn(size, className)} role="img" aria-label="Toncoin">
      <defs>
        <linearGradient id="ton-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0098EA" />
          <stop offset="100%" stopColor="#0072B5" />
        </linearGradient>
        <linearGradient id="ton-diamond-l" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="ton-diamond-r" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="ton-shine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Background circle with gradient */}
      <circle cx="16" cy="16" r="16" fill="url(#ton-bg)" />
      {/* Shine overlay on top half */}
      <circle cx="16" cy="16" r="16" fill="url(#ton-shine)" />
      {/* Left facet of diamond */}
      <path
        d="M10.182 10C8.348 10 7.307 12.02 8.426 13.41L15.245 21.9c.2.252.5.378.755.378V12.12h-3.284l3.284-2.12H10.182z"
        fill="url(#ton-diamond-l)"
      />
      {/* Right facet of diamond */}
      <path
        d="M21.818 10H16v2.12h0v10.158c.255 0 .555-.126.755-.378l6.819-8.49c1.119-1.39.078-3.41-1.756-3.41zM17.5 12.12v4.09l3.284-4.09H17.5z"
        fill="url(#ton-diamond-r)"
      />
      {/* Center divider line for faceted look */}
      <line
        x1="16"
        y1="10"
        x2="16"
        y2="22.278"
        stroke="#fff"
        strokeWidth="0.4"
        strokeOpacity="0.4"
      />
      {/* Top edge highlight */}
      <path d="M10.182 10h11.636" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
    </svg>
  );
}

/**
 * USDT icon — polished version with subtle gradient.
 */
export function UsdtIcon({ size = "h-8 w-8", className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn(size, className)} role="img" aria-label="Tether USDT">
      <defs>
        <linearGradient id="usdt-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#26A17B" />
          <stop offset="100%" stopColor="#1E8C69" />
        </linearGradient>
        <linearGradient id="usdt-shine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#usdt-bg)" />
      <circle cx="16" cy="16" r="16" fill="url(#usdt-shine)" />
      <path
        d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
        fill="#fff"
      />
    </svg>
  );
}
