import clsx from 'clsx';

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-lg border bg-white dark:bg-black',
        'border-neutral-200 dark:border-neutral-800',
        'hover:border-blue-600 dark:hover:border-blue-600 transition-colors duration-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
