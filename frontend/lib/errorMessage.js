function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val));
    } catch {
      return "";
    }
  }
}

export function getErrorMessage(error, fallback = "Terjadi kesalahan. Silakan coba lagi.") {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  if (
    typeof error?.message === "string" &&
    error.message.trim() &&
    error.message.trim() !== "[object Object]"
  ) {
    return error.message;
  }

  const data = error?.data;

  if (typeof data?.error?.message === "string" && data.error.message.trim()) {
    return data.error.message;
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (typeof error?.code === "string" && error.code.trim()) {
    return error.code;
  }

  const stringified = safeJsonStringify(error);
  if (stringified && stringified !== "{}") return stringified;

  return fallback;
}
