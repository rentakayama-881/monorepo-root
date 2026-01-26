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
       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 120" width="450" height="120">
    <defs>
    <!-- Premium Gradient untuk Icon -->
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#000000"/>
      <stop offset="50%" stop-color="#615cff"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    
    <!-- Premium Icon Glow -->
    <filter id="iconGlow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur1"/>
      <feFlood flood-color="#000000" flood-opacity="0.4" result="color1"/>
      <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>
      
      <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="blur2"/>
      <feFlood flood-color="#615cff" flood-opacity="0.7" result="color2"/>
      <feComposite in="color2" in2="blur2" operator="in" result="glow2"/>
      
      <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur3"/>
      <feFlood flood-color="#6366f1" flood-opacity="0.8" result="color3"/>
      <feComposite in="color3" in2="blur3" operator="in" result="glow3"/>
      
      <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur4"/>
      <feFlood flood-color="#ffffff" flood-opacity="0.6" result="color4"/>
      <feComposite in="color4" in2="blur4" operator="in" result="glow4"/>
      
      <feMerge>
        <feMergeNode in="glow1"/>
        <feMergeNode in="glow2"/>
        <feMergeNode in="glow3"/>
        <feMergeNode in="glow4"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Premium Text Shadow - 10 layers -->
    <filter id="textShadow" x="-200%" y="-200%" width="500%" height="500%">
      <feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#615cff" flood-opacity="1"/>
      <feDropShadow dx="0" dy="0" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="1"/>
      <feDropShadow dx="0" dy="0" stdDeviation="1" flood-color="#000000" flood-opacity="0.8"/>
      <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="#ffffff" flood-opacity="1"/>
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#6366f1" flood-opacity="1"/>
      <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#615cff" flood-opacity="1"/>
      <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#615cff" flood-opacity="1"/>
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#000000" flood-opacity="0.5"/>
      <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#6366f1" flood-opacity="0.9"/>
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#ffffff" flood-opacity="0.7"/>
    </filter>
    
    <!-- Import Google Font - Orbitron (futuristic premium) -->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&amp;display=swap');
    </style>
    </defs>
  
  <!-- ICON with premium gradient glow -->
  <g transform="translate(20,20)" filter="url(#iconGlow)">
    <circle cx="40" cy="40" r="28" fill="none" stroke="url(#iconGrad)" stroke-width="3"/>
    <circle cx="40" cy="40" r="18" fill="none" stroke="#615cff" stroke-width="1.5" opacity="0.7"/>
    <polygon points="40,16 58,28 58,52 40,64 22,52 22,28" fill="none" stroke="#000000" stroke-width="2.5" opacity="0.8"/>
    
    <g transform="translate(40, 39)">
      <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.9">
        <path d="M-8,-12 L8,12" />
        <path d="M-3,-12 C-3,-8 3,-4 7,-2" />
        <path d="M3,12 C3,8 -3,4 -7,2" />
      </g>
    </g>
    
    <circle cx="40" cy="18" r="3" fill="#615cff"/>
    <circle cx="56" cy="50" r="3" fill="#000000"/>
    <circle cx="24" cy="50" r="3" fill="#ffffff"/>
  </g>
  
  <!-- TEXT with premium font and shadow -->
  <g transform="translate(120, 30)" filter="url(#textShadow)">
    <text
      x="0" y="40"
      font-family="'Orbitron', 'Helvetica Neue', Arial, sans-serif"
      font-size="44"
      font-weight="900"
      letter-spacing="1"
      fill="#6366f1"
    >
      Alephdraad
    </text>
   </g>
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

