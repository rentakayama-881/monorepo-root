'use client';

import Image from 'next/image';
import Link from 'next/link';

export function Logo({
  variant = 'full',
  theme = 'auto',
  size = 40,
  href = '/',
  link = true,
  priority = false,
  onClick,
  className = '',
  text = 'AIvalid',
}) {
  const showText = variant === 'horizontal' || variant === 'full';

  const textSizeClass = size >= 40 ? 'text-2xl' : size >= 32 ? 'text-xl' : 'text-lg';

  const iconAlt = showText ? '' : text;
  const iconAriaHidden = showText ? true : undefined;
  const iconSizes = `${size}px`;

  const renderIcon = () => {
    const lightIcon = (
      <Image
        src="/logo/logo-icon-only.svg"
        alt={iconAlt}
        aria-hidden={iconAriaHidden}
        width={size}
        height={size}
        sizes={iconSizes}
        priority={priority}
        className={theme === 'auto' ? 'dark:hidden' : undefined}
      />
    );

    const darkIcon = (
      <Image
        src="/logo/logo-icon-only-dark.svg"
        alt={iconAlt}
        aria-hidden={iconAriaHidden}
        width={size}
        height={size}
        sizes={iconSizes}
        priority={priority}
        className={theme === 'auto' ? 'hidden dark:block' : undefined}
      />
    );

    if (theme === 'dark') return darkIcon;
    if (theme === 'light') return lightIcon;
    return (
      <>
        {lightIcon}
        {darkIcon}
      </>
    );
  };

  const content = (
    <>
      {renderIcon()}
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
