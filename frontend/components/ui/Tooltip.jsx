"use client";

import { useState, useId, useRef, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";
import Portal from "@/components/ui/Portal";

function getPosition(triggerRect, side, align, gap = 8) {
  const pos = { top: 0, left: 0 };

  // Calculate top/left based on side
  switch (side) {
    case "top":
      pos.top = triggerRect.top - gap;
      pos.left = triggerRect.left + triggerRect.width / 2;
      break;
    case "bottom":
      pos.top = triggerRect.bottom + gap;
      pos.left = triggerRect.left + triggerRect.width / 2;
      break;
    case "left":
      pos.top = triggerRect.top + triggerRect.height / 2;
      pos.left = triggerRect.left - gap;
      break;
    case "right":
      pos.top = triggerRect.top + triggerRect.height / 2;
      pos.left = triggerRect.right + gap;
      break;
  }

  // Build transform based on side + align
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

  // Adjust left for horizontal sides with alignment
  if ((side === "top" || side === "bottom") && align === "start") {
    pos.left = triggerRect.left;
  } else if ((side === "top" || side === "bottom") && align === "end") {
    pos.left = triggerRect.right;
  }

  // Adjust top for vertical sides with alignment
  if ((side === "left" || side === "right") && align === "start") {
    pos.top = triggerRect.top;
  } else if ((side === "left" || side === "right") && align === "end") {
    pos.top = triggerRect.bottom;
  }

  return {
    position: "fixed",
    top: `${pos.top}px`,
    left: `${pos.left}px`,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

export default function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 300,
  className,
}) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState({});
  const triggerRef = useRef(null);
  const timerRef = useRef(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle(getPosition(rect, side, align));
  }, [side, align]);

  const show = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    // Don't show on touch-only devices
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) return;
    timerRef.current = setTimeout(show, delayDuration);
  }, [show, delayDuration]);

  const handleMouseLeave = useCallback(() => {
    hide();
  }, [hide]);

  const handleFocus = useCallback(() => {
    // Show immediately for keyboard users
    show();
  }, [show]);

  const handleBlur = useCallback(() => {
    hide();
  }, [hide]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  // If no content, render children without tooltip
  if (!content) {
    return children;
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={visible ? tooltipId : undefined}
        style={{ display: "inline-flex" }}
      >
        {children}
      </span>

      {visible && (
        <Portal>
          <div
            id={tooltipId}
            role="tooltip"
            style={style}
            className={cn(
              "z-50 max-w-xs rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
              className
            )}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}

Tooltip.propTypes = {
  content: PropTypes.node,
  children: PropTypes.node,
  side: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  align: PropTypes.oneOf(["start", "center", "end"]),
  delayDuration: PropTypes.number,
  className: PropTypes.string,
};
