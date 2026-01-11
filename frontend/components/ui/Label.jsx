import clsx from "clsx";

export default function Label({ title, amount, currencyCode, position = "bottom" }) {
  const positionClass =
    position === "center"
      ? "top-1/2 -translate-y-1/2 transform"
      : "bottom-0 pb-4";

  return (
    <div
      className={clsx(
        "pointer-events-none absolute left-0 flex w-full justify-center px-4",
        positionClass
      )}
    >
      <div className="w-full max-w-xs rounded-lg bg-black/70 px-3 py-2 text-white backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-white/80">
          {title}
        </p>
        <p className="text-lg font-semibold leading-tight">
          {currencyCode} {amount}
        </p>
      </div>
    </div>
  );
}
