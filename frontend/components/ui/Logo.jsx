'use client';

import Link from 'next/link';

export function Logo({
  variant = 'full',
  theme = 'auto',
  size = 40,
  link = true,
  className = ''
}) {
  
  // Fungsi untuk merender SVG secara Inline agar font Aref Ruqaa terbaca
  const LogoContent = ({ isDark }) => {
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
          <linearGradient id={`iconGrad-${isDark ? 'dark' : 'light'}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={iconPrimary}/>
            <stop offset="50%" stopColor="#6366f1"/>
            <stop offset="100%" stopColor={isDark ? "#ffffff" : "#615cff"}/>
          </linearGradient>
        </defs>

        {/* Bagian Icon */}
        <g transform="translate(20,20)">
          <circle cx="40" cy="40" r="28" fill="none" stroke={`url(#iconGrad-${isDark ? 'dark' : 'light'})`} strokeWidth="3"/>
          <circle cx="40" cy="40" r="18" fill="none" stroke="#615cff" strokeWidth="1.5" opacity="0.7"/>
          <g transform="translate(40, 39)">
            <path d="M-8,-12 L8,12" fill="none" stroke={isDark ? "#ffffff" : "#000000"} strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M-3,-12 C-3,-8 3,-4 7,-2" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M3,12 C3,8 -3,4 -7,2" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"/>
          </g>
        </g>

        {/* Teks Logo - Hanya muncul jika varian horizontal atau full */}
        {(variant === 'horizontal' || variant === 'full') && (
          <text
            x="100" y="80"
            fill={textColor}
            style={{ 
              fontFamily: 'var(--font-aref-ruqaa), serif',
              fontSize: '55px',
              fontWeight: '700'
            }}
          >
            Alephdraad
          </text>
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

