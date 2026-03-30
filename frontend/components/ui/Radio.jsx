"use client";

import {
  memo,
  forwardRef,
  createContext,
  useContext,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// ─── Context ──────────────────────────────────────────────
const RadioGroupContext = createContext(null);

function useRadioGroup() {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) {
    throw new Error("RadioGroupItem must be used within a RadioGroup");
  }
  return ctx;
}

// ─── RadioGroup ───────────────────────────────────────────
/**
 * Radio group container that manages selected value via context
 * @param {string} props.value - Controlled selected value
 * @param {string} props.defaultValue - Initial selected value (uncontrolled)
 * @param {function} props.onValueChange - Callback when value changes
 * @param {string} props.name - Form field name
 * @param {boolean} props.disabled - Whether all items are disabled
 * @param {"vertical"|"horizontal"} props.orientation - Layout direction
 * @param {string} props.label - Group label
 * @param {string} props.error - Error message
 * @param {boolean} props.required - Whether field is required
 * @param {React.ReactNode} props.children - RadioGroupItem children
 * @param {string} props.className - Additional CSS classes
 */
function RadioGroup({
  value: controlledValue,
  defaultValue,
  onValueChange,
  name,
  disabled = false,
  orientation = "vertical",
  label,
  error,
  required = false,
  children,
  className,
  ...props
}) {
  const generatedId = useId();
  const groupId = `radio-group-${generatedId}`;
  const errorId = `${groupId}-error`;

  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const selectedValue = isControlled ? controlledValue : internalValue;

  const groupRef = useRef(null);

  const handleValueChange = useCallback(
    (newValue) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (disabled) return;

      const items = groupRef.current?.querySelectorAll(
        '[role="radio"]:not([aria-disabled="true"])'
      );
      if (!items || items.length === 0) return;

      const currentIndex = Array.from(items).findIndex((item) => item === document.activeElement);

      let nextIndex = -1;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }

      if (nextIndex >= 0) {
        const nextItem = items[nextIndex];
        nextItem.focus();
        const nextValue = nextItem.getAttribute("data-value");
        if (nextValue) {
          handleValueChange(nextValue);
        }
      }
    },
    [disabled, handleValueChange]
  );

  return (
    <RadioGroupContext.Provider value={{ selectedValue, handleValueChange, name, disabled }}>
      <div className="flex flex-col">
        {label && (
          <span
            className={cn("text-sm font-medium text-foreground mb-2", disabled && "opacity-50")}
            id={`${groupId}-label`}
          >
            {label}
            {required && (
              <span className="text-destructive ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </span>
        )}

        <div
          ref={groupRef}
          role="radiogroup"
          aria-required={required || undefined}
          aria-label={!label ? props["aria-label"] : undefined}
          aria-labelledby={label ? `${groupId}-label` : undefined}
          aria-describedby={error ? errorId : undefined}
          onKeyDown={handleKeyDown}
          className={cn(
            orientation === "vertical" ? "flex flex-col gap-3" : "flex flex-wrap gap-6",
            className
          )}
          {...props}
        >
          {children}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-destructive mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    </RadioGroupContext.Provider>
  );
}

// ─── RadioGroupItem ───────────────────────────────────────
/**
 * Individual radio option within a RadioGroup
 * @param {string} props.value - Radio value (required)
 * @param {string} props.label - Label text
 * @param {string} props.description - Description text
 * @param {boolean} props.disabled - Whether this item is disabled
 * @param {string} props.className - Additional CSS classes
 */
const RadioGroupItem = memo(
  forwardRef(function RadioGroupItem(
    { value, label, description, disabled: itemDisabled, className, ...props },
    ref
  ) {
    const { selectedValue, handleValueChange, name, disabled: groupDisabled } = useRadioGroup();

    const generatedId = useId();
    const itemId = props.id || generatedId;
    const isDisabled = groupDisabled || itemDisabled;
    const isChecked = selectedValue === value;

    const handleClick = useCallback(() => {
      if (isDisabled) return;
      handleValueChange(value);
    }, [isDisabled, handleValueChange, value]);

    return (
      <div className={cn("flex items-start gap-3", className)}>
        {/* Hidden native input for form compatibility */}
        <input
          type="radio"
          ref={ref}
          name={name}
          value={value}
          checked={isChecked}
          disabled={isDisabled}
          onChange={() => handleValueChange(value)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Styled radio circle */}
        <div
          role="radio"
          aria-checked={isChecked}
          aria-disabled={isDisabled || undefined}
          data-value={value}
          tabIndex={isDisabled ? -1 : 0}
          onClick={handleClick}
          className={cn(
            "peer size-4 shrink-0 rounded-full border border-border bg-background transition-all duration-150 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "flex items-center justify-center",
            isChecked && "border-primary",
            isDisabled && "cursor-not-allowed opacity-50",
            !isDisabled && "cursor-pointer"
          )}
        >
          {/* Inner dot */}
          <div
            className={cn(
              "size-2 rounded-full bg-primary transition-transform duration-150",
              isChecked ? "scale-100" : "scale-0"
            )}
            aria-hidden="true"
          />
        </div>

        {/* Label & description */}
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={itemId}
                onClick={handleClick}
                className={cn(
                  "text-sm font-medium text-foreground cursor-pointer",
                  isDisabled && "cursor-not-allowed opacity-50"
                )}
              >
                {label}
              </label>
            )}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        )}
      </div>
    );
  })
);

RadioGroupItem.displayName = "RadioGroupItem";

export default RadioGroup;
export { RadioGroupItem };
