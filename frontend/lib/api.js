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
      // Prioritaskan pesan error dari backend
      const message = data?.error || data?.message || res.statusText || `Request gagal dengan status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data?.code;
      throw error;
    }

    return data ?? (await res.json());
  } catch (err) {
    // Jangan override error message yang sudah ada dari backend
    if (err.message && err.status) {
      throw err;
    }
    
    if (controller.signal.aborted) {
      throw new Error("Request timeout. Silakan coba lagi.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request dibatalkan.");
    }
    
    // Hanya throw network error jika memang network issue
    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    }
    
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function fetchHealth() {
  return fetchJson("/api/health", { method: "GET" });
}
