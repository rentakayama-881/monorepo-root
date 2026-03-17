"use client";

import Link from "next/link";

export function Logo({
  size = 40,
  href = "/",
  link = true,
  onClick,
  className = "",
  text = "aivalid.id",
}) {
  const textSizeClass = size >= 40 ? "text-2xl" : size >= 32 ? "text-xl" : "text-lg";

  const content = (
    <span className={`leading-none font-bold tracking-tight ${textSizeClass}`}>{text}</span>
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

export default Logo;
