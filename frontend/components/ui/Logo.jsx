'use client';

import Image from 'next/image';
import Link from 'next/link';

export function Logo({
  variant = 'full',
  size = 40,
  link = true,
  className = '',
  text = 'AIvalid',
}) {
  const showText = variant === 'horizontal' || variant === 'full';

  const textSizeClass = size >= 40 ? 'text-2xl' : size >= 32 ? 'text-xl' : 'text-lg';

  const content = (
    <>
      <Image
        src="/logo/logo-icon-only.svg"
        alt={`${text} logo`}
        width={size}
        height={size}
        priority
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
      <Link href="/" className={`${baseClassName} focus:outline-none rounded-lg`}>
        {content}
      </Link>
    );
  };

  return <span className={baseClassName}>{content}</span>;
}

// Named export untuk kompatibilitas
export const LogoSVG = Logo;
export default Logo;
