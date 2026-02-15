"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api";
import { getToken, TOKEN_KEY, AUTH_CHANGED_EVENT } from "@/lib/auth";
import { getDeviceFingerprintWithTimeout } from "@/lib/fingerprint";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Listen for auth changes from other tabs (cross-tab sync)
  useEffect(() => {
    // Check if already logged in on mount
    const token = getToken();
    if (token) {
      router.replace("/");
      return;
    }

    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === TOKEN_KEY && e.newValue) {
        router.replace("/");
      }
    };

    // Listen for auth changes in same tab
    const handleAuthChange = () => {
      const token = getToken();
      if (token) {
        router.replace("/");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, [router]);

  // Calculate password strength
  useEffect(() => {
    const pass = form.password;
    if (!pass) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (pass.length >= 12) strength++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++;
    if (/\d/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    
    setPasswordStrength(Math.min(strength, 3)); // Max 3 bars
  }, [form.password]);

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
  const primaryButton =
    "w-full inline-flex justify-center items-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    // Validate username is required
    if (!form.username || form.username.trim() === "") {
      setError("Username is required.");
      setLoading(false);
      return;
    }

    try {
      // Get device fingerprint (with timeout for graceful degradation)
      const deviceFingerprint = await getDeviceFingerprintWithTimeout(3000);

      const payload = {
        email: form.email,
        password: form.password,
        username: form.username,
        full_name: form.full_name || undefined,
        device_fingerprint: deviceFingerprint,
      };
      await fetchJson(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Registration with email verification doesn't return tokens
      // User must verify email first, then login
      setInfo("Account created. Verify your email, then continue to login.");
      setForm({ email: "", password: "", username: "", full_name: "" });
      setTimeout(() => router.replace("/login?registered=1"), 600);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-bg">
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Register with email, choose a handle, and launch your first validation flow.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputClass}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                required
                value={form.password}
                minLength={8}
                onChange={(e) => update("password", e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
              />
              {form.password && (
                <div className="password-strength">
                  <div
                    className={`password-strength-bar ${passwordStrength >= 1 ? "active password-strength-weak" : ""}`}
                  />
                  <div
                    className={`password-strength-bar ${passwordStrength >= 2 ? "active password-strength-medium" : ""}`}
                  />
                  <div
                    className={`password-strength-bar ${passwordStrength >= 3 ? "active password-strength-strong" : ""}`}
                  />
                </div>
              )}
              {form.password && (
                <p
                  className={`text-xs ${passwordStrength <= 1 ? "text-destructive" : passwordStrength === 2 ? "text-warning" : "text-success"}`}
                >
                  {passwordStrength <= 1
                    ? "Weak password"
                    : passwordStrength === 2
                      ? "Moderate password"
                      : "Strong password"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                className={inputClass}
                placeholder="your_handle"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Display name (optional)</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
                {info}
              </div>
            )}
            <button type="submit" disabled={loading} className={primaryButton}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
