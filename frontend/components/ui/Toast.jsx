"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

/**
 * Toast Provider - wrap your app with this to enable toast notifications
 * Usage:
 *   const { toast } = useToast();
 *   toast({ title: "Success", description: "...", type: "success" });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, description, type = "info", duration = 4000 }) => {
    const id = Date.now() + Math.random();
    const newToast = { id, title, description, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options) => addToast(options),
    [addToast]
  );

  // Shorthand methods
  toast.success = (title, description) => addToast({ title, description, type: "success" });
  toast.error = (title, description) => addToast({ title, description, type: "error" });
  toast.warning = (title, description) => addToast({ title, description, type: "warning" });
  toast.info = (title, description) => addToast({ title, description, type: "info" });

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

function Toast({ title, description, type, onClose }) {
  const typeStyles = {
    success: "bg-[rgb(var(--success-bg))] border-[rgb(var(--success-border))] text-[rgb(var(--success))]",
    error: "bg-[rgb(var(--error-bg))] border-[rgb(var(--error-border))] text-[rgb(var(--error))]",
    warning: "bg-[rgb(var(--warning-bg))] border-[rgb(var(--warning-border))] text-[rgb(var(--warning))]",
    info: "bg-[rgb(var(--surface-2))] border-[rgb(var(--border))] text-[rgb(var(--fg))]",
  };

  const iconPaths = {
    success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  return (
    <div
      className={`rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5 fade-in duration-300 ${typeStyles[type]}`}
      role="alert"
    >
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
            d={iconPaths[type]}
          />
        </svg>
        <div className="flex-1 min-w-0">
          {title && <p className="font-medium">{title}</p>}
          {description && (
            <p className={`text-sm ${title ? "mt-1 opacity-90" : ""}`}>
              {description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Tutup notifikasi"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}
