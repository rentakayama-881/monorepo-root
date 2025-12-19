import clsx from 'clsx';

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        // Base Layout
        'group relative overflow-hidden rounded-lg border',
        // LIGHT MODE: Background Putih, Teks Slate Gelap (Mirip Codex), Border Halus
        'bg-white text-slate-900 border-neutral-200',
        // DARK MODE: Background Hitam, Teks Putih, Border Abu Gelap
        'dark:bg-black dark:text-white dark:border-neutral-800',
        // Hover Effects (Vercel Style)
        'transition-all duration-300 hover:border-blue-600 dark:hover:border-blue-600',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
