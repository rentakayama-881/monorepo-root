import { getValidToken } from "@/lib/tokenRefresh";

const DEFAULT_SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

export async function requireValidTokenOrThrow(message = DEFAULT_SESSION_EXPIRED_MESSAGE) {
  const token = await getValidToken();
  if (token) return token;

  const error = new Error(message);
  error.status = 401;
  error.code = "session_expired";
  throw error;
}

export async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createApiErrorFromData(data, fallbackMessage) {
  const error = new Error(data?.message || data?.error || fallbackMessage);
  error.code = data?.code;
  error.details = data?.details;
  error.data = data;
  return error;
}

export async function throwApiError(response, fallbackMessage) {
  const data = await readJsonSafe(response);
  throw createApiErrorFromData(data, fallbackMessage);
}
