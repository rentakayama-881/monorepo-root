'use client';

import Link from 'next/link';

export function Logo({
  variant = 'full',
  theme = 'auto',
  size = 40,
  link = true,
  className = ''
}) {
  
      const LogoContent = ({ isDark }) => {
    // Kita pakai warna dinamis sesuai tema tapi tetep premium
    const textColor = isDark ? "#ffffff" : "#6366f1";
    const iconPrimary = isDark ? "#8B949E" : "#000000";

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
            <stop offset="0%" stopColor={iconPrimary}/>
            <stop offset="50%" stopColor="#615cff"/>
            <stop offset="100%" stopColor={isDark ? "#ffffff" : "#615cff"}/>
          </linearGradient>
          
          {/* 100% Accurate Premium Icon Glow */}
          <filter id={`iconGlow-${isDark}`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur1"/>
            <feFlood floodColor={iconPrimary} floodOpacity="0.4" result="color1"/>
            <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="blur2"/>
            <feFlood floodColor="#615cff" floodOpacity="0.7" result="color2"/>
            <feComposite in="color2" in2="blur2" operator="in" result="glow2"/>
            <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur3"/>
            <feFlood floodColor="#6366f1" floodOpacity="0.8" result="color3"/>
            <feComposite in="color3" in2="blur3" operator="in" result="glow3"/>
            <feMerge>
              <feMergeNode in="glow1"/><feMergeNode in="glow2"/><feMergeNode in="glow3"/><feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* 100% Accurate Premium Text Shadow (10 Layers) */}
          <filter id={`textShadow-${isDark}`} x="-200%" y="-200%" width="500%" height="500%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.5" floodColor="#615cff" floodOpacity="1"/>
            <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor={isDark ? "#000000" : "#ffffff"} floodOpacity="0.8"/>
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#6366f1" floodOpacity="1"/>
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#6366f1" floodOpacity="0.9"/>
          </filter>
        </defs>

        {/* ICON Area */}
        <g transform="translate(20,20)" filter={`url(#iconGlow-${isDark})`}>
          <circle cx="40" cy="40" r="28" fill="none" stroke={`url(#iconGrad-${isDark})`} strokeWidth="3"/>
          <circle cx="40" cy="40" r="18" fill="none" stroke="#615cff" strokeWidth="1.5" opacity="0.7"/>
          <polygon points="40,16 58,28 58,52 40,64 22,52 22,28" fill="none" stroke={iconPrimary} strokeWidth="2.5" opacity="0.8"/>
          
          <g transform="translate(40, 39)">
            <g stroke={isDark ? "#ffffff" : "#ffffff"} strokeWidth="2.5" strokeLinecap="round" fill="none">
              <path d="M-8,-12 L8,12" />
              <path d="M-3,-12 C-3,-8 3,-4 7,-2" />
              <path d="M3,12 C3,8 -3,4 -7,2" />
            </g>
          </g>
          <circle cx="40" cy="18" r="3" fill="#615cff"/>
          <circle cx="56" cy="50" r="3" fill={iconPrimary}/>
          <circle cx="24" cy="50" r="3" fill="#ffffff"/>
        </g>

        {/* TEXT Area */}
        {(variant === 'horizontal' || variant === 'full') && (
          <g transform="translate(115, 30)" filter={`url(#textShadow-${isDark})`}>
            <text
              x="0" y="48"
              fill={textColor}
              style={{ 
                fontFamily: 'var(--font-aref-ruqaa), serif',
                fontSize: '54px',
                fontWeight: '700'
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
        <span className="dark:hidden"><LogoContent isDark={false} /></span>
        <span className="hidden dark:inline"><LogoContent isDark={true} /></span>
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

