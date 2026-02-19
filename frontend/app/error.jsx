"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import logger from "@/lib/logger";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error using production-safe logger
    logger.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Error icon with animation */}
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6 animate-scale-in">
          <div className="relative">
            <svg
              className="w-10 h-10 text-destructive animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-3 animate-slide-up">
          Something went wrong
        </h2>

        <p className="text-muted-foreground mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          We encountered an issue while loading this page. Please try again,
          or return to the home page.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Button onClick={reset} variant="primary">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </Button>
          <Button href="/" variant="secondary">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Home
          </Button>
        </div>

        {/* Contact support link */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">Need assistance?</p>
          <Button href="/contact-support" variant="ghost" className="text-xs">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Contact Support
          </Button>
        </div>

        {/* Error details (development only) */}
        {process.env.NODE_ENV === "development" && error?.message && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Error Details (Development)
            </summary>
            <pre className="mt-2 p-3 bg-muted/50 rounded-md text-xs overflow-auto text-destructive max-h-48">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
