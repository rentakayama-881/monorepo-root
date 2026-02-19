"use server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_INTERNAL_URL ||
  "http://localhost:8080";

export async function registerAction(formData) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const username = formData.get("username")?.toString().trim();
  const fullName = formData.get("full_name")?.toString().trim();

  if (!email || !password || !username) {
    return { success: false, error: "Email, password, and username are required." };
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        username,
        full_name: fullName || undefined,
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error: data?.message || data?.error || "Registration failed.",
        code: data?.code,
        details: data?.details,
      };
    }

    return {
      success: true,
      message: data?.message || "Registration completed. Please verify your email before signing in.",
    };
  } catch (err) {
    return {
      success: false,
      error: "Unable to connect to the server. Please check your internet connection.",
    };
  }
}
