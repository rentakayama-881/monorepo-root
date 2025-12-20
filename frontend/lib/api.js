export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
}

export async function fetchJson(path, options = {}) {
  const { timeout = 10000, signal, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeout);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
  }

  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      ...rest,
      signal: controller.signal,
    });

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const message = data?.error || res.statusText || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    return data ?? (await res.json());
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("Request timed out");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request was aborted");
    }
    throw new Error("Network error: backend unreachable");
  } finally {
    clearTimeout(timeoutId);
  }
}

export function fetchHealth() {
  return fetchJson("/api/health", { method: "GET" });
}
