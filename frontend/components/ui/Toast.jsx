"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

const ToastContext = createContext(null);

/**
 * Toast Provider - wrap your app with this to enable toast notifications
 * Usage:
 *   const { toast } = useToast();
 *   toast({ title: "Success", description: "...", variant: "success" });
 */
export function ToastProvider({ children, position = "bottom-right" }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    ({ title, description, variant = "info", duration = 4000, action }) => {
      const id = crypto.randomUUID();
      const newToast = { id, title, description, variant, duration, action };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options) => addToast(options),
    [addToast]
  );

  // Shorthand methods
  toast.success = (title, description, options = {}) =>
    addToast({ title, description, variant: "success", ...options });
  toast.error = (title, description, options = {}) =>
    addToast({ title, description, variant: "error", ...options });
  toast.warning = (title, description, options = {}) =>
    addToast({ title, description, variant: "warning", ...options });
  toast.info = (title, description, options = {}) =>
    addToast({ title, description, variant: "info", ...options });

  // Promise toast
  toast.promise = async (promise, { loading, success, error }) => {
    const id = addToast({
      title: loading,
      variant: "info",
      duration: 0,
    });

    try {
      const result = await promise;
      removeToast(id);
      addToast({
        title: typeof success === "function" ? success(result) : success,
        variant: "success",
      });
      return result;
    } catch (err) {
      removeToast(id);
      addToast({
        title: typeof error === "function" ? error(err) : error,
        variant: "error",
      });
      throw err;
    }
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} position={position} />
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node,
  position: PropTypes.oneOf([
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ]),
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({ toasts, onRemove, position }) {
  if (toasts.length === 0) return null;

  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
    "bottom-right": "bottom-4 right-4",
  };

  return (
    <div
      className={clsx(
        "fixed z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none",
        positionClasses[position]
      )}
    >
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => onRemove(toast.id)}
          index={index}
        />
      ))}
    </div>
  );
}

ToastContainer.propTypes = {
  toasts: PropTypes.array.isRequired,
  onRemove: PropTypes.func.isRequired,
  position: PropTypes.string.isRequired,
};

function Toast({ title, description, variant, onClose, duration, action, index }) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const toastRef = useRef(null);
  const startXRef = useRef(0);
  const progressRef = useRef(null);

  const variantStyles = {
    success:
      "bg-success/10 border-success/30 text-success dark:bg-success/10 dark:border-success/30 dark:text-success",
    error:
      "bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/10 dark:border-destructive/30 dark:text-destructive",
    warning:
      "bg-warning/10 border-warning/30 text-warning dark:bg-warning/10 dark:border-warning/30 dark:text-warning",
    info: "bg-muted/50 border-border text-foreground",
  };

  const iconPaths = {
    success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    warning:
      "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(onClose, 200);
  };

  // Swipe to dismiss
  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    setDragX(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(dragX) > 100) {
      handleDismiss();
    } else {
      setDragX(0);
    }
  };

  // Progress bar animation
  useEffect(() => {
    if (duration > 0 && progressRef.current) {
      progressRef.current.style.animation = `progress ${duration}ms linear forwards`;
    }
  }, [duration]);

  return (
    <div
      ref={toastRef}
      className={clsx(
        "rounded-lg border shadow-lg transition-all duration-200 pointer-events-auto",
        "animate-slide-in-from-right",
        variantStyles[variant],
        isDismissing && "opacity-0 translate-x-full",
        index > 0 && "mt-2"
      )}
      style={{
        transform: `translateX(${dragX}px)`,
        transition: isDragging ? "none" : "all 0.2s",
      }}
      role="alert"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/30 rounded-b-lg overflow-hidden">
          <div
            ref={progressRef}
            className="h-full bg-current opacity-50 origin-left"
            style={{ transformOrigin: "left" }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={iconPaths[variant]}
            />
          </svg>
          <div className="flex-1 min-w-0">
            {title && <p className="font-medium">{title}</p>}
            {description && (
              <p className={`text-sm ${title ? "mt-1 opacity-90" : ""}`}>
                {description}
              </p>
            )}
            {action && (
              <button
                onClick={action.onClick}
                className="mt-2 text-sm font-medium underline-offset-2 hover:underline"
              >
                {action.label}
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close notification"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

Toast.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  variant: PropTypes.oneOf(["success", "error", "warning", "info"]),
  onClose: PropTypes.func.isRequired,
  duration: PropTypes.number,
  action: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
  }),
  index: PropTypes.number,
};
