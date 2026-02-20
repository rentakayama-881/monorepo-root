"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AUTH_INPUT_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthCard,
  AuthContainer,
  AuthField,
  AuthHeader,
  AuthNotice,
} from "@/components/auth/AuthPrimitives";
import { fetchJson } from "@/lib/api";
import { getDeviceFingerprintWithTimeout } from "@/lib/fingerprint";
import {
  getPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthTone,
} from "@/lib/passwordStrength";
import useAuthRedirectGuard from "@/lib/useAuthRedirectGuard";
import { useRouter } from "next/navigation";

const strengthToneClassName = {
  weak: "text-destructive",
  medium: "text-warning",
  strong: "text-success",
};

export default function RegisterPage() {
  const router = useRouter();

  useAuthRedirectGuard({ redirectTo: "/" });

  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    full_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const passwordStrengthTone = getPasswordStrengthTone(passwordStrength);
  const passwordStrengthLabel = getPasswordStrengthLabel(passwordStrength);

  function update(key, value) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (!form.username || form.username.trim() === "") {
      setError("Username is required.");
      setLoading(false);
      return;
    }

    try {
      const deviceFingerprint = await getDeviceFingerprintWithTimeout(3000);

      await fetchJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          username: form.username,
          full_name: form.full_name || undefined,
          device_fingerprint: deviceFingerprint,
        }),
      });

      setInfo("Account created. Verify your email, then continue to login.");
      setForm({ email: "", password: "", username: "", full_name: "" });
      setTimeout(() => router.replace("/login?registered=1"), 600);
    } catch (submitError) {
      setError(submitError?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-bg">
      <AuthContainer>
        <AuthHeader
          title="Create your account"
          description="Register with email, choose a handle, and launch your first validation flow."
        />

        <AuthCard>
          <form className="space-y-4" onSubmit={onSubmit}>
            <AuthField label="Email" htmlFor="register-email">
              <input
                id="register-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="name@example.com"
              />
            </AuthField>

            <AuthField label="Password" htmlFor="register-password">
              <input
                id="register-password"
                type="password"
                required
                value={form.password}
                minLength={8}
                onChange={(event) => update("password", event.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="At least 8 characters"
              />

              {form.password ? (
                <>
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

                  <p className={`text-xs ${strengthToneClassName[passwordStrengthTone]}`}>
                    {passwordStrengthLabel}
                  </p>
                </>
              ) : null}
            </AuthField>

            <AuthField label="Username" htmlFor="register-username">
              <input
                id="register-username"
                type="text"
                required
                value={form.username}
                onChange={(event) => update("username", event.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="your_handle"
              />
            </AuthField>

            <AuthField label="Display name (optional)" htmlFor="register-display-name">
              <input
                id="register-display-name"
                type="text"
                value={form.full_name}
                onChange={(event) => update("full_name", event.target.value)}
                className={AUTH_INPUT_CLASS}
                placeholder="Your name"
              />
            </AuthField>

            {error ? <AuthNotice variant="error">{error}</AuthNotice> : null}
            {info ? <AuthNotice variant="success">{info}</AuthNotice> : null}

            <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON_CLASS}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </AuthCard>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Login
          </Link>
        </div>
      </AuthContainer>
    </div>
  );
}
