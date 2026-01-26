'use client';
import Link from 'next/link';

export function Logo({
  variant = 'full',
  theme = 'auto',
  size = 40,
  link = true,
  className = '',
}) {
  const LogoContent = ({ isDark }) => {
    /**
     * Branding V4:
     * - Jangan hardcode hex lama (ungu #6366f1 / #615cff, dst).
     * - Ambil dari semantic tokens + palette tokens yang sudah kamu define di globals.css.
     *
     * Catatan kompatibilitas:
     * CSS var() valid untuk stopColor/floodColor/fill/stroke di SVG modern browser.
     */
    const COLORS = isDark
      ? {
          text: 'var(--foreground)', // dark: silver terang (dari globals.css)
          iconPrimary: 'var(--color-silver-200)',
          gradMid: 'var(--color-fuchsia-plum-500)',
          gradEnd: 'var(--color-silver-50)',
          ring: 'var(--ring)',
          shadowSoft: 'var(--color-space-indigo-950)',
        }
      : {
          text: 'var(--primary)', // light: identitas utama
          iconPrimary: 'var(--color-space-indigo-950)',
          gradMid: 'var(--color-fuchsia-plum-500)',
          gradEnd: 'var(--primary)',
          ring: 'var(--ring)',
          shadowSoft: 'var(--color-silver-50)',
        };

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 450 120"
        width={variant === 'horizontal' ? size * 3.75 : size}
        height={size}
        className={className}
      >
        <defs>
          <linearGradient id={`iconGrad-${isDark}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={COLORS.iconPrimary} />
            <stop offset="50%" stopColor={COLORS.gradMid} />
            <stop offset="100%" stopColor={COLORS.gradEnd} />
          </linearGradient>

          {/* Premium Icon Glow (brand-aware) */}
          <filter id={`iconGlow-${isDark}`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur1" />
            <feFlood floodColor={COLORS.iconPrimary} floodOpacity="0.35" result="color1" />
            <feComposite in="color1" in2="blur1" operator="in" result="glow1" />

            <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="blur2" />
            <feFlood floodColor={COLORS.gradMid} floodOpacity="0.55" result="color2" />
            <feComposite in="color2" in2="blur2" operator="in" result="glow2" />

            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur3" />
            <feFlood floodColor={COLORS.ring} floodOpacity="0.5" result="color3" />
            <feComposite in="color3" in2="blur3" operator="in" result="glow3" />

            <feMerge>
              <feMergeNode in="glow1" />
              <feMergeNode in="glow2" />
              <feMergeNode in="glow3" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Premium Text Shadow */}
          <filter id={`textShadow-${isDark}`} x="-200%" y="-200%" width="500%" height="500%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.5" floodColor={COLORS.gradMid} floodOpacity="0.9" />
            <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor={COLORS.shadowSoft} floodOpacity="0.55" />
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={COLORS.ring} floodOpacity="0.8" />
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={COLORS.ring} floodOpacity="0.6" />
          </filter>
        </defs>

        {/* ICON Area */}
        <g transform="translate(20,20)" filter={`url(#iconGlow-${isDark})`}>
          <circle cx="40" cy="40" r="28" fill="none" stroke={`url(#iconGrad-${isDark})`} strokeWidth="3" />

          {/* inner ring: tetap brand tone (pakai ring), bukan ungu hardcode */}
          <circle cx="40" cy="40" r="18" fill="none" stroke={COLORS.ring} strokeWidth="1.5" opacity="0.55" />

          <polygon
            points="40,16 58,28 58,52 40,64 22,52 22,28"
            fill="none"
            stroke={COLORS.iconPrimary}
            strokeWidth="2.5"
            opacity="0.8"
          />

          <g transform="translate(40, 39)">
            {/* Biarkan putih untuk kontras maksimum (ikon tetap terbaca di light/dark) */}
            <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <path d="M-8,-12 L8,12" />
              <path d="M-3,-12 C-3,-8 3,-4 7,-2" />
              <path d="M3,12 C3,8 -3,4 -7,2" />
            </g>
          </g>

          {/* Dots: pakai palette */}
          <circle cx="40" cy="18" r="3" fill={COLORS.gradMid} />
          <circle cx="56" cy="50" r="3" fill={COLORS.iconPrimary} />
          <circle cx="24" cy="50" r="3" fill={COLORS.gradEnd} />
        </g>

        {/* TEXT Area */}
        {(variant === 'horizontal' || variant === 'full') && (
          <g transform="translate(115, 30)" filter={`url(#textShadow-${isDark})`}>
            <text
              x="0"
              y="48"
              fill={COLORS.text}
              style={{
                fontFamily: 'var(--font-aref-ruqaa), serif',
                fontSize: '54px',
                fontWeight: '700',
              }}
            >
              Alephdraad
            </text>
          </g>
        )}
      </svg>
    );
  };

  const renderThemedLogo = () => {
    if (theme === 'light') return <LogoContent isDark={false} />;
    if (theme === 'dark') return <LogoContent isDark={true} />;

    return (
      <>
        <span className="dark:hidden">
          <LogoContent isDark={false} />
        </span>
        <span className="hidden dark:inline">
          <LogoContent isDark={true} />
        </span>
      </>
    );
  };

  if (link) {
    return (
      <Link href="/" className="inline-flex items-center focus:outline-none rounded-lg">
        {renderThemedLogo()}
      </Link>
    );
  }

  return renderThemedLogo();
}

// Named export untuk kompatibilitas
export const LogoSVG = Logo;
export default Logo;
