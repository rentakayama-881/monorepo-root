import clsx from 'clsx';

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        // Style Dasar
        'group relative overflow-hidden rounded-lg border',
        // LIGHT MODE: Background Putih, Border Abu
        'bg-white border-neutral-200 text-neutral-900',
        // DARK MODE: Background Hitam, Border Abu Gelap, DAN TEKS PUTIH (Solusi Masalahmu)
        'dark:bg-black dark:border-neutral-800 dark:text-neutral-100',
        // Hover Effect
        'hover:border-blue-600 dark:hover:border-blue-600 transition-colors duration-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

