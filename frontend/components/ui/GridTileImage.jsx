import clsx from "clsx";
import Image from "next/image";
import Label from "./Label";

export function GridTileImage({
  isInteractive = true,
  active,
  label,
  ...props
}) {
  return (
    <div
      className={clsx(
        "group flex h-full w-full items-center justify-center overflow-hidden rounded-lg border bg-[rgb(var(--surface))] hover:border-[rgb(var(--brand))]",
        {
          relative: !!label,
          "border-2 border-[rgb(var(--brand))]": active,
          "border-[rgb(var(--border))]": !active,
        }
      )}
    >
      {props.src ? (
        <Image
          className={clsx("relative h-full w-full object-contain", {
            "transition duration-300 ease-in-out group-hover:scale-105": isInteractive,
          })}
          {...props}
        />
      ) : null}
      {label ? (
        <Label
          title={label.title}
          amount={label.amount}
          currencyCode={label.currencyCode}
          position={label.position}
        />
      ) : null}
    </div>
  );
}
