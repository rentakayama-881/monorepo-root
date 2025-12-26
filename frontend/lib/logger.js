/**
 * Logger utility for frontend
 * Only logs in development mode to avoid console pollution in production
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  /**
   * Log error messages
   * @param {string} message - Error message
   * @param  {...any} args - Additional arguments
   */
  error: (message, ...args) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, ...args);
    }
    // TODO: In production, send to error tracking service (e.g., Sentry)
  },

  /**
   * Log warning messages
   * @param {string} message - Warning message
   * @param  {...any} args - Additional arguments
   */
  warn: (message, ...args) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Log info messages
   * @param {string} message - Info message
   * @param  {...any} args - Additional arguments
   */
  info: (message, ...args) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log debug messages
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
