"use client";

import {
  createContext,
  useContext,
  useState,
  useId,
  useRef,
  useCallback,
  useEffect,
  cloneElement,
  isValidElement,
} from "react";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";
import Portal from "@/components/ui/Portal";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PopoverContext = createContext(null);

function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error("Popover compound components must be used within <Popover>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Position helper
// ---------------------------------------------------------------------------

function getPosition(triggerRect, side, align, sideOffset) {
  const pos = { top: 0, left: 0 };

  switch (side) {
    case "top":
      pos.top = triggerRect.top - sideOffset;
      break;
    case "bottom":
      pos.top = triggerRect.bottom + sideOffset;
      break;
    case "left":
      pos.left = triggerRect.left - sideOffset;
      pos.top = triggerRect.top + triggerRect.height / 2;
      break;
    case "right":
      pos.left = triggerRect.right + sideOffset;
      pos.top = triggerRect.top + triggerRect.height / 2;
      break;
  }

  // Horizontal alignment for top/bottom
  if (side === "top" || side === "bottom") {
    if (align === "start") pos.left = triggerRect.left;
    else if (align === "end") pos.left = triggerRect.right;
    else pos.left = triggerRect.left + triggerRect.width / 2;
  }

  // Build transform
  let translateX = "-50%";
  let translateY = "0%";

  if (side === "top") {
    translateY = "-100%";
    if (align === "start") translateX = "0%";
    else if (align === "end") translateX = "-100%";
  } else if (side === "bottom") {
    translateY = "0%";
    if (align === "start") translateX = "0%";
    else if (align === "end") translateX = "-100%";
  } else if (side === "left") {
    translateX = "-100%";
    translateY = "-50%";
    if (align === "start") translateY = "0%";
    else if (align === "end") translateY = "-100%";
  } else if (side === "right") {
    translateX = "0%";
    translateY = "-50%";
    if (align === "start") translateY = "0%";
    else if (align === "end") translateY = "-100%";
  }

  return {
    position: "fixed",
    top: `${pos.top}px`,
    left: `${pos.left}px`,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

function flipIfNeeded(triggerRect, side, sideOffset) {
  const margin = 16;
  switch (side) {
    case "bottom":
      if (triggerRect.bottom + sideOffset + 200 > window.innerHeight) return "top";
      break;
    case "top":
      if (triggerRect.top - sideOffset - 200 < 0) return "bottom";
      break;
    case "left":
      if (triggerRect.left - sideOffset - 200 < margin) return "right";
      break;
    case "right":
      if (triggerRect.right + sideOffset + 200 > window.innerWidth - margin) return "left";
      break;
  }
  return side;
}

// ---------------------------------------------------------------------------
// Popover (root)
// ---------------------------------------------------------------------------

export default function Popover({ open: controlledOpen, onOpenChange, children }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const triggerRef = useRef(null);
  const contentId = useId();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(isOpen) : next;
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, isOpen, onOpenChange]
  );

  const toggle = useCallback(() => setOpen((prev) => !prev), [setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <PopoverContext.Provider value={{ isOpen, toggle, close, triggerRef, contentId }}>
      {children}
    </PopoverContext.Provider>
  );
}

Popover.propTypes = {
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  children: PropTypes.node,
};

// ---------------------------------------------------------------------------
// PopoverTrigger
// ---------------------------------------------------------------------------

export function PopoverTrigger({ children, asChild = false, className }) {
  const { isOpen, toggle, triggerRef, contentId } = usePopoverContext();

  const triggerProps = {
    ref: triggerRef,
    onClick: toggle,
    "aria-expanded": isOpen,
    "aria-haspopup": "dialog",
    "aria-controls": isOpen ? contentId : undefined,
  };

  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      ...triggerProps,
      className: cn(children.props.className, className),
    });
  }

  return (
    <button type="button" className={className} {...triggerProps}>
      {children}
    </button>
  );
}

PopoverTrigger.propTypes = {
  children: PropTypes.node,
  asChild: PropTypes.bool,
  className: PropTypes.string,
};

// ---------------------------------------------------------------------------
// PopoverContent
// ---------------------------------------------------------------------------

export function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  className,
  onInteractOutside,
}) {
  const { isOpen, close, triggerRef, contentId } = usePopoverContext();
  const contentRef = useRef(null);
  const [style, setStyle] = useState({});
  const [mounted, setMounted] = useState(false);

  // Calculate position whenever popover opens
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const resolvedSide = flipIfNeeded(rect, side, sideOffset);
    setStyle(getPosition(rect, resolvedSide, align, sideOffset));

    // Trigger mount animation
    requestAnimationFrame(() => setMounted(true));

    return () => setMounted(false);
  }, [isOpen, side, align, sideOffset, triggerRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close, triggerRef]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        if (onInteractOutside) {
          onInteractOutside(e);
        } else {
          close();
        }
      }
    };

    // Delay to avoid catching the same click that opened the popover
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, close, triggerRef, onInteractOutside]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        ref={contentRef}
        id={contentId}
        role="dialog"
        style={{
          ...style,
          opacity: mounted ? 1 : 0,
          transition: "opacity 150ms ease-in-out",
        }}
        className={cn(
          "z-50 w-72 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-md",
          className
        )}
      >
        {children}
      </div>
    </Portal>
  );
}

PopoverContent.propTypes = {
  children: PropTypes.node,
  side: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  align: PropTypes.oneOf(["start", "center", "end"]),
  sideOffset: PropTypes.number,
  className: PropTypes.string,
  onInteractOutside: PropTypes.func,
};
