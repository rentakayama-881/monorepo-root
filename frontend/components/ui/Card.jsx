import clsx from 'clsx';

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        // Base Layout
        'group relative overflow-hidden rounded-lg border',
        // Colors using CSS custom properties
        'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] border-[rgb(var(--border))]',
        // Hover Effects (GitHub Style - subtle border change)
        'transition-colors hover:border-[rgb(var(--muted))]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
