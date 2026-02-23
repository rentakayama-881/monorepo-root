/**
 * Logger utility for frontend
 * In development: logs to console
 * In production: sends errors/warnings to Sentry
 */
import * as Sentry from "@sentry/browser";

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  /**
   * Log error messages - sent to Sentry in production
   * @param {string} message - Error message
   * @param  {...any} args - Additional arguments
   */
  error: (message, ...args) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, ...args);
    } else {
      const extra = args.length > 0 ? { details: args } : undefined;
      Sentry.captureException(
        message instanceof Error ? message : new Error(message),
        extra ? { extra } : undefined,
      );
    }
  },

  /**
   * Log warning messages - sent to Sentry in production
   * @param {string} message - Warning message
   * @param  {...any} args - Additional arguments
   */
  warn: (message, ...args) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    } else {
      const extra = args.length > 0 ? { details: args } : undefined;
      Sentry.captureMessage(message, {
        level: "warning",
        ...(extra ? { extra } : {}),
      });
    }
  },

  /**
   * Log info messages - console only (dev) / no-op (prod)
   * @param {string} message - Info message
   * @param  {...any} args - Additional arguments
   */
  info: (message, ...args) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log debug messages - console only (dev) / no-op (prod)
   * @param {string} message - Debug message
   * @param  {...any} args - Additional arguments
   */
  debug: (message, ...args) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};

export default logger;
