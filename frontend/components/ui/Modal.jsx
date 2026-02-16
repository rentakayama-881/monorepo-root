"use client";

import React, { useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Modal component with focus trap and premium features:
 * - open: boolean untuk show/hide
 * - onClose: function dipanggil saat close (backdrop click, ESC, atau X button)
 * - title: string (optional, tampil di header)
 * - children: content modal
 * - size: "sm" | "md" | "lg" | "xl" | "full" (default "md")
 * - variant: "default" | "slide-up" (slide-up untuk mobile)
 * - showCloseButton: boolean (default true)
 * - closeOnBackdrop: boolean (default true)
 * - closeOnEscape: boolean (default true)
 */
export default function Modal({
  open = false,
  onClose,
  title = "",
  children,
  size = "md",
  variant = "default",
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = "",
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Handle ESC key
  const handleEscape = useCallback(
    (e) => {
      if (e.key === "Escape" && open && closeOnEscape) {
        onClose?.();
      }
    },
    [open, onClose, closeOnEscape]
  );

  // Focus trap
  useEffect(() => {
    if (open && modalRef.current) {
      // Store currently focused element
      previousActiveElement.current = document.activeElement;

      // Get all focusable elements
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Focus first element
      firstElement?.focus();

      // Trap focus within modal
      const handleTab = (e) => {
        if (e.key === "Tab") {
          if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            // Tab
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleTab);
      return () => {
        document.removeEventListener("keydown", handleTab);
        // Restore focus
        previousActiveElement.current?.focus();
      };
    }
  }, [open]);

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-full w-full h-full m-0 rounded-none",
  };

  // Use CSS media query instead of JS window width check for better performance
  const shouldSlideUp = variant === "slide-up";

  const modalStyles = clsx(
    "relative w-full bg-card shadow-xl",
    size === "full" ? "h-full" : "rounded-lg border",
    sizeClasses[size],
    shouldSlideUp
      ? "animate-slide-up"
      : "animate-in fade-in zoom-in-95 duration-200",
    className
  );

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose?.();
    }
  };

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[140] flex justify-center",
        shouldSlideUp ? "items-end sm:items-center" : "items-center",
        size === "full" ? "p-0" : "p-4",
        // Mobile-first: slide up from bottom on small screens for better UX
        size !== "full" && "max-sm:items-end"
      )}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className={modalStyles}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between border-b px-4 py-3">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-foreground">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={clsx("p-4", size === "full" && "h-full overflow-auto")}>
          {/* Close button if no header */}
          {!title && !showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors z-10"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

Modal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  children: PropTypes.node,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl", "full"]),
  variant: PropTypes.oneOf(["default", "slide-up"]),
  showCloseButton: PropTypes.bool,
  closeOnBackdrop: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  className: PropTypes.string,
};

/**
 * ModalHeader - Structured header for modal
 */
export function ModalHeader({ children, className = "" }) {
  return (
    <div className={clsx("border-b px-4 py-3", className)}>
      {children}
    </div>
  );
}

ModalHeader.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * ModalBody - Structured body for modal content
 */
export function ModalBody({ children, className = "" }) {
  return (
    <div className={clsx("p-4", className)}>
      {children}
    </div>
  );
}

ModalBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * ModalFooter - Structured footer for modal actions
 */
export function ModalFooter({ children, className = "" }) {
  return (
    <div className={clsx("border-t px-4 py-3 flex items-center justify-end gap-2", className)}>
      {children}
    </div>
  );
}

ModalFooter.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};
