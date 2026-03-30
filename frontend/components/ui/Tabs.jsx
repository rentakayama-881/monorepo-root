"use client";

import { memo, createContext, useContext, useState, useCallback, useRef, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Tabs context — shares active value and setter across compound components
 */
const TabsContext = createContext(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs compound components must be used within <Tabs>");
  }
  return ctx;
}

/**
 * Tabs root — manages active tab state
 * Supports controlled (value + onChange) and uncontrolled (defaultValue) modes
 */
const Tabs = memo(function Tabs({
  value: controlledValue,
  onChange,
  defaultValue = "",
  className,
  children,
  ...props
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;
  const instanceId = useId();

  const setActiveValue = useCallback(
    (newValue) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onChange?.(newValue);
    },
    [isControlled, onChange]
  );

  return (
    <TabsContext.Provider value={{ activeValue, setActiveValue, instanceId }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
});

/**
 * TabsList — container for tab triggers
 */
const TabsList = memo(function TabsList({ className, children, ...props }) {
  const { activeValue, setActiveValue } = useTabsContext();
  const listRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      const list = listRef.current;
      if (!list) return;

      const triggers = Array.from(list.querySelectorAll('[role="tab"]:not([disabled])'));
      if (triggers.length === 0) return;

      const currentIndex = triggers.findIndex((trigger) => trigger === document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = -1;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextIndex = (currentIndex + 1) % triggers.length;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = triggers.length - 1;
          break;
        default:
          return;
      }

      if (nextIndex >= 0) {
        const nextTrigger = triggers[nextIndex];
        nextTrigger.focus();
        const nextValue = nextTrigger.getAttribute("data-value");
        if (nextValue) {
          setActiveValue(nextValue);
        }
      }
    },
    [setActiveValue]
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn("flex border-b border-border", className)}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
});

/**
 * TabsTrigger — individual tab button
 */
const TabsTrigger = memo(function TabsTrigger({
  value,
  children,
  disabled = false,
  icon,
  badge,
  className,
  ...props
}) {
  const { activeValue, setActiveValue, instanceId } = useTabsContext();
  const isActive = activeValue === value;
  const triggerId = `tab-${instanceId}-${value}`;
  const panelId = `tabpanel-${instanceId}-${value}`;

  const handleClick = useCallback(() => {
    if (!disabled) {
      setActiveValue(value);
    }
  }, [disabled, setActiveValue, value]);

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault();
        setActiveValue(value);
      }
    },
    [disabled, setActiveValue, value]
  );

  return (
    <button
      id={triggerId}
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={panelId}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      data-value={value}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive &&
          "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5">
        {icon && <span className="inline-flex shrink-0">{icon}</span>}
        {children}
        {badge != null && (
          <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium leading-none text-muted-foreground">
            {badge}
          </span>
        )}
      </span>
    </button>
  );
});

/**
 * TabsContent — panel shown when its value matches the active tab
 */
const TabsContent = memo(function TabsContent({
  value,
  children,
  className,
  forceMount = false,
  ...props
}) {
  const { activeValue, instanceId } = useTabsContext();
  const isActive = activeValue === value;
  const triggerId = `tab-${instanceId}-${value}`;
  const panelId = `tabpanel-${instanceId}-${value}`;

  if (!isActive && !forceMount) {
    return null;
  }

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={triggerId}
      tabIndex={0}
      hidden={!isActive}
      className={cn("pt-6 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
});

export default Tabs;
export { Tabs, TabsList, TabsTrigger, TabsContent };
