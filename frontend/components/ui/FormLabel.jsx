import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * FormLabel component for form elements with enhanced features
 * @param {string} props.htmlFor - ID of the associated form element
 * @param {React.ReactNode} props.children - Label text
 * @param {boolean} props.required - Show required indicator (red asterisk)
 * @param {boolean} props.optional - Show optional badge
 * @param {string} props.tooltip - Tooltip text for help
 * @param {boolean} props.error - Error state styling
 * @param {string} props.className - Additional CSS classes
 */
export default function FormLabel({
  htmlFor,
  children,
  required = false,
  optional = false,
  tooltip = "",
  error = false,
  className = "",
}) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div className="flex items-center gap-1.5 mb-1">
      <label
        htmlFor={htmlFor}
        className={clsx(
          "text-sm font-medium transition-colors",
          error ? "text-destructive" : "text-foreground",
          className
        )}
      >
        {children}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
        {optional && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            optional
          </span>
        )}
      </label>
      {tooltip && (
        <div className="relative">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="More information"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          {showTooltip && (
            <div className="absolute z-50 left-0 top-full mt-1 w-max max-w-xs px-2 py-1 text-xs text-foreground bg-popover border border-border rounded shadow-lg animate-fade-in">
              {tooltip}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

FormLabel.propTypes = {
  htmlFor: PropTypes.string,
  children: PropTypes.node.isRequired,
  required: PropTypes.bool,
  optional: PropTypes.bool,
  tooltip: PropTypes.string,
  error: PropTypes.bool,
  className: PropTypes.string,
};
