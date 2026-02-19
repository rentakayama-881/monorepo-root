const DEFAULT_ALERT = {
  variant: "error",
  title: "An error occurred",
};

const ALERT_BY_CODE = {
  AUTH005: {
    variant: "error",
    title: "Invalid token",
    message: "Token is invalid or expired. Please sign in again.",
  },
  AUTH009: {
    variant: "warning",
    title: "Account locked",
    message: "Your account is locked due to suspicious activity.",
  },
  AUTH012: {
    variant: "warning",
    title: "Account temporarily locked",
    message: "Too many failed login attempts. Please try again later.",
  },
  AUTH013: {
    variant: "warning",
    title: "Attempts limited",
    message: "Please wait before attempting to sign in again.",
  },
  AUTH014: {
    variant: "warning",
    title: "Verification limited",
    message: "Too many verification attempts. Please try again later.",
  },
  RATE001: {
    variant: "warning",
    title: "Too many requests",
    message: "Please wait a moment before trying again.",
  },
  RATE002: {
    variant: "warning",
    title: "Request limit reached",
    message: "Please wait a moment before trying again.",
  },
};

function extractErrorInfo(error) {
  if (!error) return {};
  if (typeof error === "string") {
    return { message: error };
  }
  return {
    message: error.message,
    code: error.code,
    details: error.details || error.data?.details,
  };
}

export function mapApiErrorToAlert(error) {
  const { code, message, details } = extractErrorInfo(error);
  const mapped = code && ALERT_BY_CODE[code] ? { ...ALERT_BY_CODE[code] } : { ...DEFAULT_ALERT };
  const fallbackMessage = message || mapped.message || "An error occurred. Please try again.";
  const baseMessage = mapped.message || fallbackMessage;
  const combinedMessage = details && details !== baseMessage ? `${baseMessage} ${details}` : baseMessage;

  return {
    variant: mapped.variant || DEFAULT_ALERT.variant,
    title: mapped.title || DEFAULT_ALERT.title,
    message: combinedMessage,
  };
}
