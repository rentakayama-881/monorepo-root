"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const AccordionContext = createContext(null);
const AccordionItemContext = createContext(null);

function useAccordionContext() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion compound components must be used within <Accordion>");
  return ctx;
}

function useAccordionItemContext() {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) throw new Error("AccordionTrigger/Content must be used within <AccordionItem>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Accordion (root)
// ---------------------------------------------------------------------------

export default function Accordion({
  type = "single",
  defaultValue,
  value: controlledValue,
  onValueChange,
  collapsible = true,
  children,
  className,
}) {
  const [internalValue, setInternalValue] = useState(() => {
    if (controlledValue !== undefined) return controlledValue;
    if (defaultValue !== undefined) {
      return type === "multiple"
        ? Array.isArray(defaultValue)
          ? defaultValue
          : [defaultValue]
        : defaultValue;
    }
    return type === "multiple" ? [] : "";
  });

  const isControlled = controlledValue !== undefined;
  const openValue = isControlled ? controlledValue : internalValue;

  const triggerRefs = useRef([]);

  const isItemOpen = useCallback(
    (itemValue) => {
      if (type === "multiple") {
        return Array.isArray(openValue) && openValue.includes(itemValue);
      }
      return openValue === itemValue;
    },
    [type, openValue]
  );

  const toggleItem = useCallback(
    (itemValue) => {
      let next;

      if (type === "multiple") {
        const current = Array.isArray(openValue) ? openValue : [];
        if (current.includes(itemValue)) {
          next = current.filter((v) => v !== itemValue);
        } else {
          next = [...current, itemValue];
        }
      } else {
        // single mode
        if (openValue === itemValue) {
          next = collapsible ? "" : itemValue;
        } else {
          next = itemValue;
        }
      }

      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [type, openValue, collapsible, isControlled, onValueChange]
  );

  const registerTrigger = useCallback((ref) => {
    if (ref && !triggerRefs.current.includes(ref)) {
      triggerRefs.current.push(ref);
    }
  }, []);

  const unregisterTrigger = useCallback((ref) => {
    triggerRefs.current = triggerRefs.current.filter((r) => r !== ref);
  }, []);

  const focusTrigger = useCallback((direction, currentRef) => {
    const triggers = triggerRefs.current.filter((r) => !r.disabled);
    const index = triggers.indexOf(currentRef);
    if (index === -1) return;

    let nextIndex;
    if (direction === "next") {
      nextIndex = (index + 1) % triggers.length;
    } else if (direction === "prev") {
      nextIndex = (index - 1 + triggers.length) % triggers.length;
    } else if (direction === "first") {
      nextIndex = 0;
    } else if (direction === "last") {
      nextIndex = triggers.length - 1;
    }

    triggers[nextIndex]?.focus();
  }, []);

  return (
    <AccordionContext.Provider
      value={{ isItemOpen, toggleItem, registerTrigger, unregisterTrigger, focusTrigger }}
    >
      <div className={className} data-orientation="vertical">
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

Accordion.propTypes = {
  type: PropTypes.oneOf(["single", "multiple"]),
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  onValueChange: PropTypes.func,
  collapsible: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
};

// ---------------------------------------------------------------------------
// AccordionItem
// ---------------------------------------------------------------------------

export function AccordionItem({ value, children, disabled = false, className }) {
  const { isItemOpen } = useAccordionContext();
  const open = isItemOpen(value);

  return (
    <AccordionItemContext.Provider value={{ value, isOpen: open, disabled }}>
      <div
        className={cn("border-b border-border", className)}
        data-state={open ? "open" : "closed"}
        data-disabled={disabled || undefined}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

AccordionItem.propTypes = {
  value: PropTypes.string.isRequired,
  children: PropTypes.node,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

// ---------------------------------------------------------------------------
// AccordionTrigger
// ---------------------------------------------------------------------------

export function AccordionTrigger({ children, className }) {
  const { toggleItem, registerTrigger, unregisterTrigger, focusTrigger } = useAccordionContext();
  const { value, isOpen, disabled } = useAccordionItemContext();
  const buttonRef = useRef(null);

  useEffect(() => {
    const el = buttonRef.current;
    if (el) registerTrigger(el);
    return () => {
      if (el) unregisterTrigger(el);
    };
  }, [registerTrigger, unregisterTrigger]);

  const handleClick = useCallback(() => {
    if (!disabled) toggleItem(value);
  }, [disabled, toggleItem, value]);

  const handleKeyDown = useCallback(
    (e) => {
      const ref = buttonRef.current;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusTrigger("next", ref);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusTrigger("prev", ref);
          break;
        case "Home":
          e.preventDefault();
          focusTrigger("first", ref);
          break;
        case "End":
          e.preventDefault();
          focusTrigger("last", ref);
          break;
      }
    },
    [focusTrigger]
  );

  return (
    <h3 className="flex">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        data-state={isOpen ? "open" : "closed"}
        className={cn(
          "flex w-full items-center justify-between py-4 text-sm font-medium text-foreground transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
          className
        )}
      >
        <span>{children}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </h3>
  );
}

AccordionTrigger.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

// ---------------------------------------------------------------------------
// AccordionContent
// ---------------------------------------------------------------------------

export function AccordionContent({ children, className }) {
  const { isOpen } = useAccordionItemContext();
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (contentRef.current) {
        setHeight(isOpen ? contentRef.current.scrollHeight : 0);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  return (
    <div
      ref={contentRef}
      role="region"
      aria-hidden={!isOpen}
      data-state={isOpen ? "open" : "closed"}
      style={{
        height: `${height}px`,
        opacity: isOpen ? 1 : 0,
      }}
      className={cn(
        "overflow-hidden text-sm text-foreground/80 transition-all duration-200 ease-out",
        className
      )}
    >
      <div className="pb-4 pt-0">{children}</div>
    </div>
  );
}

AccordionContent.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};
