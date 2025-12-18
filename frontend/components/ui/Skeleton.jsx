import clsx from "clsx";

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={clsx("animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800", className)}
      {...props}
    />
  );
}
