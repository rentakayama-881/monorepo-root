"use server";

import { cookies } from "next/headers";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_INTERNAL_URL ||
  "http://localhost:8080";

export async function loginAction(formData) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { success: false, error: "Email dan password wajib diisi" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Check for 2FA requirement
      if (res.status === 403 && data?.code === "2FA_REQUIRED") {
        return {
          success: false,
          requires2FA: true,
          tempToken: data?.temp_token,
          error: data?.message || "Verifikasi 2FA diperlukan",
        };
      }

      return {
        success: false,
        error: data?.message || data?.error || "Login gagal",
        code: data?.code,
      };
    }

    // Return tokens for client-side storage
    return {
      success: true,
      accessToken: data?.access_token || data?.token,
      refreshToken: data?.refresh_token,
      expiresIn: data?.expires_in,
      user: data?.user,
    };
  } catch (err) {
    return {
      success: false,
      error: "Tidak dapat terhubung ke server. Periksa koneksi internet.",
    };
  }
}

export async function registerAction(formData) {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const username = formData.get("username")?.toString().trim();
  const fullName = formData.get("full_name")?.toString().trim();

  if (!email || !password || !username) {
    return { success: false, error: "Email, password, dan username wajib diisi" };
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
        error: data?.message || data?.error || "Pendaftaran gagal",
        code: data?.code,
        details: data?.details,
      };
    }

    return {
      success: true,
      message: data?.message || "Pendaftaran berhasil. Silakan cek email untuk verifikasi.",
    };
  } catch (err) {
    return {
      success: false,
      error: "Tidak dapat terhubung ke server. Periksa koneksi internet.",
    };
  }
}
