'use client';

import Image from 'next/image';
import Link from 'next/link';

/**
 * Alephdraad Logo Component
 * 
 * Mathematical Foundation:
 * - Golden Ratio (φ = 1.618) proportions
 * - Fibonacci Spiral for organic growth
 * - Hexagonal symmetry (6-fold)
 * - Möbius-inspired outer ring
 * 
 * Colors:
 * - Gray: #57606A, #8B949E (GitHub Primer palette)
 * - Orange: #DA7756 (Claude Anthropic coral)
 * 
 * @param {Object} props
 * @param {'full' | 'icon' | 'horizontal'} props.variant - Logo variant
 * @param {'light' | 'dark' | 'auto'} props.theme - Color theme
 * @param {number} props.size - Size in pixels (height for horizontal, width/height for others)
 * @param {boolean} props.link - Whether to wrap in a link to home
 * @param {string} props.className - Additional CSS classes
 */
export function Logo({ 
  variant = 'full', 
  theme = 'auto', 
  size = 40,
  link = true,
  className = '' 
}) {
  // Determine the logo source based on variant and theme
  const getLogoSrc = (isDark) => {
    const suffix = isDark ? '-dark' : '';
    
    switch (variant) {
      case 'icon':
        return `/logo/logo-icon-only${suffix}.svg`;
      case 'horizontal':
        return `/logo/logo-horizontal${suffix}.svg`;
      case 'full':
      default:
        return `/logo/logo-${isDark ? 'dark' : 'light'}.svg`;
    }
  };

  // Calculate dimensions based on variant
  const getDimensions = () => {
    switch (variant) {
      case 'horizontal':
        // Horizontal logo has 4:1 aspect ratio
        return { width: size * 4, height: size };
      case 'icon':
      case 'full':
      default:
        return { width: size, height: size };
    }
  };

  const dimensions = getDimensions();

  const LogoImage = ({ isDark }) => (
    <Image
      src={getLogoSrc(isDark)}
      alt="Alephdraad"
      width={dimensions.width}
      height={dimensions.height}
      className={className}
      priority
    />
  );

  // Render based on theme mode
  const renderLogo = () => {
    if (theme === 'light') {
      return <LogoImage isDark={false} />;
    }
    
    if (theme === 'dark') {
      return <LogoImage isDark={true} />;
    }

    // Auto mode: show both with CSS to toggle
    return (
      <>
        {/* Light mode logo - hidden in dark mode */}
        <span className="dark:hidden">
          <LogoImage isDark={false} />
        </span>
        {/* Dark mode logo - hidden in light mode */}
        <span className="hidden dark:inline">
          <LogoImage isDark={true} />
        </span>
      </>
    );
  };

  if (link) {
    return (
      <Link 
        href="/" 
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-lg"
        aria-label="Alephdraad - Go to homepage"
      >
        {renderLogo()}
      </Link>
    );
  }

  return <span className="inline-flex items-center">{renderLogo()}</span>;
}

/**
 * Inline SVG Logo Component for better performance
 * Uses the mathematical formulas directly
 */
export function LogoSVG({ 
  size = 40, 
  theme = 'auto',
  className = '' 
}) {
  // Golden Ratio constants
  const PHI = 1.618033988749;
  const scale = size / 400; // Original viewBox is 400x400
  
  // Light mode colors (Gray + Claude Orange)
  const lightColors = {
    primary: '#57606A',
    secondary: '#8B949E',
    accent: '#DA7756',
  };
  
  // Dark mode colors (Gray + Claude Orange)
  const darkColors = {
    primary: '#8B949E',
    secondary: '#C9D1D9',
    accent: '#DA7756',
  };

  const colors = theme === 'dark' ? darkColors : lightColors;
  const bgColor = theme === 'dark' ? '#0D1117' : '#F6F8FA';
  const strokeColor = theme === 'dark' ? '#C9D1D9' : '#57606A';

  return (
    <svg 
      viewBox="0 0 400 400" 
      width={size} 
      height={size}
      className={`${className} ${theme === 'auto' ? 'logo-auto-theme' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Alephdraad Logo"
    >
      <defs>
        <linearGradient id={`grad-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary}/>
          <stop offset="50%" stopColor={colors.accent}/>
          <stop offset="100%" stopColor={colors.secondary}/>
        </linearGradient>
        <radialGradient id={`center-${theme}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={colors.primary}/>
        </radialGradient>
      </defs>
      
      {/* Background */}
      <rect width="400" height="400" fill={bgColor}/>
      
      {/* Outer Ring - R1 = 140px */}
      <circle cx="200" cy="200" r="140" fill="none" stroke={`url(#grad-${theme})`} strokeWidth="5"/>
      
      {/* Second Ring - R2 = R1/φ = 86.5px */}
      <circle cx="200" cy="200" r="86.5" fill="none" stroke={colors.secondary} strokeWidth="2" opacity="0.4"/>
      
      {/* Third Ring - R3 = R2/φ = 53.5px */}
      <circle cx="200" cy="200" r="53.5" fill="none" stroke={colors.secondary} strokeWidth="1.5" opacity="0.25"/>
      
      {/* Hexagon - 6-fold symmetry */}
      <polygon 
        points="200,115 273.3,157.5 273.3,242.5 200,285 126.7,242.5 126.7,157.5" 
        fill="none" 
        stroke={`url(#grad-${theme})`} 
        strokeWidth="2.5"
        opacity="0.8"
      />
      
      {/* Inner Hexagon */}
      <polygon 
        points="200,147 245.3,175.3 245.3,224.7 200,253 154.7,224.7 154.7,175.3" 
        fill="none" 
        stroke={colors.accent} 
        strokeWidth="1.5"
        opacity="0.5"
      />
      
      {/* Aleph Symbol */}
      <g transform="translate(200, 195)">
        <path d="M-22,-35 L22,35" fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="round"/>
        <path d="M-8,-35 C-8,-25 8,-15 18,-10" fill="none" stroke={colors.accent} strokeWidth="5" strokeLinecap="round"/>
        <path d="M8,35 C8,25 -8,15 -18,10" fill="none" stroke={colors.accent} strokeWidth="5" strokeLinecap="round"/>
      </g>
      
      {/* Three Service Nodes */}
      <circle cx="200" cy="120" r="10" fill={colors.accent}/>
      <circle cx="262" cy="232" r="10" fill={strokeColor}/>
      <circle cx="138" cy="232" r="10" fill={colors.secondary}/>
      
      {/* Connection Lines */}
      <line x1="200" y1="130" x2="200" y2="155" stroke={colors.accent} strokeWidth="2" opacity="0.6"/>
      <line x1="254" y1="226" x2="222" y2="205" stroke={strokeColor} strokeWidth="2" opacity="0.6"/>
      <line x1="146" y1="226" x2="178" y2="205" stroke={colors.secondary} strokeWidth="2" opacity="0.6"/>
    </svg>
  );
}

export default Logo;
