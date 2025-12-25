import clsx from "clsx";

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={clsx("animate-pulse rounded-md bg-[rgb(var(--surface-2))]", className)}
      {...props}
    />
  );
}
