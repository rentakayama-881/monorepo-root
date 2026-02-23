"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { requireValidTokenOrThrow, readJsonSafe, throwApiError } from "@/lib/authRequest";
import { getApiBase } from "@/lib/api";
import {
  fetchFeatureAuth,
  FEATURE_ENDPOINTS,
  unwrapFeatureData,
} from "@/lib/featureApi";
import { base64URLToBuffer, serializePublicKeyCredential } from "@/lib/webauthn";
import PasskeyList from "./PasskeyList";
import { SectionLoadingBlock } from "./ui/LoadingState";

function isWebAuthnSupported() {
  return typeof window !== "undefined" && !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === "function"
  );
}

function normalizePinStatus(payload) {
  const data = unwrapFeatureData(payload) || {};
  const pinSetRaw =
    data.pinSet ?? data.PinSet ?? data.pin_set ?? data.hasPin ?? data.has_pin ?? false;
  return Boolean(pinSetRaw);
}

const PasskeyIcon = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);

const WarningIcon = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const PlusIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

export default function PasskeySettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [passkeys, setPasskeys] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registering, setRegistering] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);

  const API = `${getApiBase()}/api/auth/passkeys`;

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await throwApiError(res, "Failed to load passkeys.");
      }

      const data = await readJsonSafe(res);
      setPasskeys(data?.passkeys || []);
    } catch (err) {
      setError(err?.message || "Failed to load passkeys.");
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
    fetchPasskeys();
  }, [fetchPasskeys]);

  async function registerPasskey() {
    if (registering) return;

    if (!isWebAuthnSupported()) {
      setError("Your browser does not support Passkey/WebAuthn");
      return;
    }

    setError("");
    setSuccess("");
    setPin("");
    setPinError("");

    try {
      const pinStatus = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.PIN_STATUS);
      const hasPin = normalizePinStatus(pinStatus);
      if (!hasPin) {
        router.push("/account/wallet/set-pin?redirect=passkey");
        return;
      }

      setShowPinModal(true);
    } catch (err) {
      if (err?.code === "TWO_FACTOR_REQUIRED") {
        router.push(
          "/account/security?setup2fa=true&redirect=" +
            encodeURIComponent("/account/wallet/set-pin?redirect=passkey")
        );
        return;
      }

      if (err?.code === "PIN_REQUIRED") {
        router.push("/account/wallet/set-pin?redirect=passkey");
        return;
      }

      setError(err?.message || "Failed to prepare passkey registration.");
    }
  }

  async function confirmRegisterPasskey() {
    if (registering) return;

    const normalizedPin = String(pin || "").replace(/\D/g, "");
    if (normalizedPin.length !== 6) {
      setPinError("PIN harus 6 digit.");
      return;
    }

    setRegistering(true);
    setPinError("");
    setError("");

    try {
      const token = await requireValidTokenOrThrow();

      const beginRes = await fetch(`${API}/register/begin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: normalizedPin }),
      });
      if (!beginRes.ok) {
        await throwApiError(beginRes, "Failed to start registration.");
      }

      const beginData = await readJsonSafe(beginRes);
      const options = beginData?.options;
      const sessionId = beginData?.session_id;
      const publicKeyOptions = options?.publicKey;

      if (!publicKeyOptions || !sessionId) {
        throw new Error("Failed to start registration.");
      }
      publicKeyOptions.challenge = base64URLToBuffer(publicKeyOptions.challenge);
      publicKeyOptions.user.id = base64URLToBuffer(publicKeyOptions.user.id);

      if (publicKeyOptions.excludeCredentials) {
        publicKeyOptions.excludeCredentials = publicKeyOptions.excludeCredentials.map((cred) => ({
          ...cred,
          id: base64URLToBuffer(cred.id),
        }));
      }

      setShowPinModal(false);

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error("Registration was canceled");
      }

      const credentialForServer = serializePublicKeyCredential(credential);
      const passkeyName = prompt("Beri nama untuk passkey ini:", "Passkey") || "Passkey";

      const finishRes = await fetch(`${API}/register/finish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: passkeyName,
          session_id: sessionId,
          credential: credentialForServer,
        }),
      });

      if (!finishRes.ok) {
        await throwApiError(finishRes, "Failed to complete registration.");
      }

      setPin("");
      setSuccess("Passkey registered successfully!");
      await fetchPasskeys();
    } catch (err) {
      if (err?.code === "TWO_FACTOR_REQUIRED") {
        setShowPinModal(false);
        router.push(
          "/account/security?setup2fa=true&redirect=" +
            encodeURIComponent("/account/wallet/set-pin?redirect=passkey")
        );
        return;
      }

      if (err?.code === "PIN_REQUIRED") {
        setShowPinModal(false);
        router.push("/account/wallet/set-pin?redirect=passkey");
        return;
      }

      if (err?.code === "INVALID_PIN") {
        setPinError(err?.message || "PIN transaksi tidak valid.");
        return;
      }

      if (err.name === "NotAllowedError") {
        setError("Registration was canceled atau tidak diizinkan");
      } else if (err.name === "InvalidStateError") {
        setError("Passkey ini sudah terdaftar");
      } else {
        setError(err?.message || "Failed to register passkey.");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function deletePasskey(id) {
    if (!confirm("Delete this passkey? You will no longer be able to sign in with it.")) {
      return;
    }

    setDeleting(id);
    setError("");
    setSuccess("");

    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(`${API}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await throwApiError(res, "Failed to delete passkey.");
      }
      setSuccess("Passkey removed successfully.");
      await fetchPasskeys();
    } catch (err) {
      setError(err?.message || "Failed to delete passkey.");
    } finally {
      setDeleting(null);
    }
  }

  async function renamePasskey(id, name) {
    setError("");
    setSuccess("");

    try {
      const token = await requireValidTokenOrThrow();
      const res = await fetch(`${API}/${id}/name`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        await throwApiError(res, "Failed to update name.");
      }
      setSuccess("Passkey name updated successfully.");
      await fetchPasskeys();
    } catch (err) {
      setError(err?.message || "Failed to update name.");
    }
  }

  if (!webAuthnSupported) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          {PasskeyIcon}
          Passkeys
        </h3>
        <div className="mt-3 p-3 rounded-md bg-warning/10 border border-warning/20">
          <div className="flex items-start gap-2">
            <span className="text-warning">{WarningIcon}</span>
            <p className="text-sm text-warning">
              Your browser does not support Passkey/WebAuthn. Gunakan browser modern seperti Chrome, Firefox, Safari, atau Edge versi terbaru.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            {PasskeyIcon}
            Passkeys
          </h3>
          <span className="text-xs text-muted-foreground">
            {passkeys.length} terdaftar
          </span>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Passkeys memungkinkan Anda login tanpa password menggunakan fingerprint, face ID, atau security key.
        </p>

        {error && (
          <div className="mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-3 p-2 rounded-md bg-success/10 border border-success/20 text-sm text-success">
            {success}
          </div>
        )}

        {loading ? (
          <div className="mt-4">
            <SectionLoadingBlock lines={2} compact srLabel="Loading passkeys" />
          </div>
        ) : (
          <>
            <PasskeyList
              passkeys={passkeys}
              onDelete={deletePasskey}
              onRename={renamePasskey}
              deleting={deleting}
            />

            <div className="mt-4">
              <button
                onClick={registerPasskey}
                disabled={registering}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {registering ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    {PlusIcon}
                    Tambah Passkey
                  </>
                )}
              </button>
            </div>

            {passkeys.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Belum ada passkey terdaftar. Tambahkan passkey untuk login lebih aman dan mudah.
              </p>
            )}
          </>
        )}
      </section>

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-bold text-foreground">Konfirmasi PIN</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Masukkan PIN transaksi untuk melanjutkan pendaftaran passkey.
            </p>

            <div className="mt-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setPinError("");
                }}
                placeholder="••••••"
                className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            {pinError && (
              <p className="mt-2 text-sm text-destructive">{pinError}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  if (registering) return;
                  setShowPinModal(false);
                  setPin("");
                  setPinError("");
                }}
                disabled={registering}
                className="flex-1 rounded-md border border-border py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={confirmRegisterPasskey}
                disabled={registering || pin.length !== 6}
                className="flex-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {registering ? "Memverifikasi..." : "Verifikasi PIN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
