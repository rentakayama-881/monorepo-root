"use client";

/**
 * Reusable empty state component for lists, tables, and pages.
 * @param {Object} props
 * @param {string} [props.icon] - Emoji or icon character
 * @param {string} props.title - Main message
 * @param {string} [props.description] - Secondary description
 * @param {React.ReactNode} [props.action] - Optional action button/link
 * @param {boolean} [props.compact] - Compact mode with less padding
 */
export default function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-8" : "py-16"
      }`}
    >
      {icon ? (
        <div className={`mb-3 ${compact ? "text-2xl" : "text-4xl"} opacity-60`}>{icon}</div>
      ) : null}
      <h3 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
        {title}
      </h3>
      {description ? (
        <p className={`mt-1 max-w-sm text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-4">
          {typeof action === "object" &&
          action !== null &&
          !("$$typeof" in action) &&
          action.label ? (
            <button
              type="button"
              onClick={action.onClick}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
            >
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      ) : null}
    </div>
  );
}
