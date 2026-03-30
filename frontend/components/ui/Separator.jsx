import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * Separator — horizontal or vertical divider line, optionally with a label
 *
 * @param {"horizontal"|"vertical"} orientation
 * @param {boolean} decorative - if true, hidden from accessibility tree
 * @param {string} label - optional text label centered on the line (horizontal only)
 * @param {string} className
 */
const Separator = memo(function Separator({
  orientation = "horizontal",
  decorative = true,
  label,
  className,
  ...props
}) {
  const ariaProps = decorative
    ? { role: "none", "aria-hidden": true }
    : { role: "separator", "aria-orientation": orientation };

  // Labeled separator — horizontal only
  if (label && orientation === "horizontal") {
    return (
      <div className={cn("flex items-center gap-3", className)} {...ariaProps} {...props}>
        <span className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
        <span className="flex-1 h-px bg-border" />
      </div>
    );
  }

  // Plain separator
  return (
    <div
      className={cn(
        orientation === "vertical" ? "w-px h-full bg-border" : "h-px w-full bg-border",
        className
      )}
      {...ariaProps}
      {...props}
    />
  );
});

export default Separator;
