"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginCredentialsForm from "@/components/auth/LoginCredentialsForm";
import LoginTotpForm from "@/components/auth/LoginTotpForm";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import { fetchJson, getApiBase } from "@/lib/api";
import { finalizeAuthSession } from "@/lib/authResponse";
import { readJsonSafe, throwApiError } from "@/lib/authRequest";
import { getDeviceFingerprintWithTimeout } from "@/lib/fingerprint";
import useAuthRedirectGuard from "@/lib/useAuthRedirectGuard";
import { base64URLToBuffer, serializePublicKeyCredential } from "@/lib/webauthn";

function isWebAuthnSupported() {
  return typeof window !== "undefined" && !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === "function"
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageLoading fullPage={false} className="auth-page-bg" message="Loading sign-in form" />}>
      <div className="auth-page-bg">
        <LoginContent />
      </div>
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useAuthRedirectGuard({ redirectTo: "/" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [requiresTOTP, setRequiresTOTP] = useState(false);
  const [totpPending, setTotpPending] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const registeredNotice = searchParams.get("registered") === "1";
  const sessionExpired = searchParams.get("session") === "expired";

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
  }, []);

  const finishAuthentication = (data) => {
    const redirectPath = finalizeAuthSession(data);
    router.replace(redirectPath);
  };

  async function onPasskeyLogin() {
    if (!isWebAuthnSupported()) {
      setError(new Error("This browser does not support passkeys."));
      return;
    }

    setPasskeyLoading(true);
    setError(null);

    try {
      const API = getApiBase();
      const deviceFingerprint = await getDeviceFingerprintWithTimeout(3000);

      const beginRes = await fetch(`${API}/api/auth/passkeys/login/begin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!beginRes.ok) {
        await throwApiError(beginRes, "Failed to initiate passkey authentication");
      }

      const beginData = await readJsonSafe(beginRes);
      const publicKeyOptions = beginData?.options?.publicKey;
      const sessionId = beginData?.session_id;

      if (!publicKeyOptions || !sessionId) {
        throw new Error("Failed to initiate passkey authentication");
      }

      publicKeyOptions.challenge = base64URLToBuffer(publicKeyOptions.challenge);

      if (publicKeyOptions.allowCredentials) {
        publicKeyOptions.allowCredentials = publicKeyOptions.allowCredentials.map((credential) => ({
          ...credential,
          id: base64URLToBuffer(credential.id),
        }));
      }

      const credential = await navigator.credentials.get({ publicKey: publicKeyOptions });

      if (!credential) {
        throw new Error("Passkey sign-in was cancelled.");
      }

      const finishRes = await fetch(`${API}/api/auth/passkeys/login/finish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          credential: serializePublicKeyCredential(credential),
          device_fingerprint: deviceFingerprint,
        }),
      });

      if (!finishRes.ok) {
        await throwApiError(finishRes, "Failed to complete authentication");
      }

      const data = await readJsonSafe(finishRes);
      if (!data) {
        throw new Error("Failed to complete authentication");
      }

      finishAuthentication(data);
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        setError(new Error("Passkey sign-in was cancelled or denied."));
      } else {
        setError(err);
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const deviceFingerprint = await getDeviceFingerprintWithTimeout(3000);

      const data = await fetchJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          device_fingerprint: deviceFingerprint,
        }),
      });

      if (data?.requires_totp) {
        setRequiresTOTP(true);
        setTotpPending(data?.totp_pending || "");
        return;
      }

      finishAuthentication(data || {});
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function onTOTPSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const deviceFingerprint = await getDeviceFingerprintWithTimeout(3000);
      const endpoint = useBackupCode ? "/api/auth/login/backup-code" : "/api/auth/login/totp";

      const response = await fetch(`${getApiBase()}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totp_pending: totpPending,
          code: totpCode,
          device_fingerprint: deviceFingerprint,
        }),
      });

      if (!response.ok) {
        await throwApiError(response, "Invalid verification code.");
      }

      const data = await readJsonSafe(response);
      if (!data) {
        throw new Error("Invalid verification code.");
      }

      finishAuthentication(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  if (requiresTOTP) {
    return (
      <LoginTotpForm
        useBackupCode={useBackupCode}
        totpCode={totpCode}
        loading={loading}
        error={error}
        onSubmit={onTOTPSubmit}
        onTotpCodeChange={setTotpCode}
        onToggleCodeType={() => {
          setUseBackupCode((previous) => !previous);
          setTotpCode("");
          setError(null);
        }}
        onBackToLogin={() => {
          setRequiresTOTP(false);
          setTotpPending("");
          setTotpCode("");
          setUseBackupCode(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <LoginCredentialsForm
      email={email}
      password={password}
      loading={loading}
      error={error}
      passkeyLoading={passkeyLoading}
      webAuthnSupported={webAuthnSupported}
      sessionExpired={sessionExpired}
      registeredNotice={registeredNotice}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      onPasskeyLogin={onPasskeyLogin}
    />
  );
}
