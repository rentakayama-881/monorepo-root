'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useTheme } from '@/lib/ThemeContext';

export function Logo({
  variant = 'full',
  size = 40,
  href = '/',
  link = true,
  priority = false,
  onClick,
  className = '',
  text = 'AIvalid',
}) {
  const { resolvedTheme } = useTheme();
  const showText = variant === 'horizontal' || variant === 'full';

  const textSizeClass = size >= 40 ? 'text-2xl' : size >= 32 ? 'text-xl' : 'text-lg';

  const iconAlt = showText ? '' : text;
  const iconAriaHidden = showText ? true : undefined;
  const iconSizes = `${size}px`;
  const iconSrc = resolvedTheme === 'dark' ? '/logo/dark-mode.svg' : '/logo/light-mode.svg';

  // Warm cache for the other theme logo to make theme switch feel instant.
  useEffect(() => {
    const otherSrc = iconSrc === '/logo/dark-mode.svg' ? '/logo/light-mode.svg' : '/logo/dark-mode.svg';

    const preload = () => {
      const img = new window.Image();
      img.decoding = 'async';
      img.src = otherSrc;
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(preload, 200);
    return () => window.clearTimeout(id);
  }, [iconSrc]);

  const content = (
    <>
      <Image
        src={iconSrc}
        alt={iconAlt}
        aria-hidden={iconAriaHidden}
        width={size}
        height={size}
        sizes={iconSizes}
        priority={priority}
      />
      {showText && (
        <span
          className={`leading-none font-bold tracking-tight ${textSizeClass}`}
          style={{ fontFamily: 'var(--font-aref-ruqaa), serif' }}
        >
          {text}
        </span>
      )}
    </>
  );

  const baseClassName = `inline-flex items-center gap-2 ${className}`.trim();

  if (link) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`${baseClassName} focus:outline-none rounded-lg`}
      >
        {content}
      </Link>
    );
  }

  return <span className={baseClassName}>{content}</span>;
}

// Named export untuk kompatibilitas
export const LogoSVG = Logo;
export default Logo;
