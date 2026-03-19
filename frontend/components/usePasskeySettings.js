import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { requireValidTokenOrThrow, readJsonSafe, throwApiError } from "@/lib/authRequest";
import { getApiBase } from "@/lib/api";
import { fetchFeatureAuth, FEATURE_ENDPOINTS, unwrapFeatureData } from "@/lib/featureApi";
import { base64URLToBuffer, serializePublicKeyCredential } from "@/lib/webauthn";

function isWebAuthnSupported() {
  return (
    typeof window !== "undefined" &&
    !!(window.PublicKeyCredential && typeof window.PublicKeyCredential === "function")
  );
}

function normalizePinStatus(payload) {
  const data = unwrapFeatureData(payload) || {};
  const pinSetRaw =
    data.pinSet ?? data.PinSet ?? data.pin_set ?? data.hasPin ?? data.has_pin ?? false;
  return Boolean(pinSetRaw);
}

export default function usePasskeySettings() {
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

  const initWebAuthnCheck = useCallback(() => {
    setWebAuthnSupported(isWebAuthnSupported());
  }, []);

  async function registerPasskey() {
    if (registering) return;

    if (!isWebAuthnSupported()) {
      setError("Browser Anda belum mendukung Passkey/WebAuthn.");
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

      setError(err?.message || "Gagal menyiapkan pendaftaran passkey.");
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
        await throwApiError(beginRes, "Gagal memulai pendaftaran.");
      }

      const beginData = await readJsonSafe(beginRes);
      const options = beginData?.options;
      const sessionId = beginData?.session_id;
      const publicKeyOptions = options?.publicKey;

      if (!publicKeyOptions || !sessionId) {
        throw new Error("Gagal memulai pendaftaran.");
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
        throw new Error("Pendaftaran dibatalkan.");
      }

      const credentialForServer = serializePublicKeyCredential(credential);
      const passkeyName = prompt("Beri nama untuk passkey ini:", "Passkey Baru") || "Passkey Baru";

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
        await throwApiError(finishRes, "Gagal menyelesaikan pendaftaran.");
      }

      setPin("");
      setSuccess("Passkey berhasil didaftarkan.");
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
        setError("Pendaftaran dibatalkan atau tidak diizinkan.");
      } else if (err.name === "InvalidStateError") {
        setError("Passkey ini sudah terdaftar.");
      } else {
        setError(err?.message || "Gagal mendaftarkan passkey.");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function deletePasskey(id) {
    if (!confirm("Hapus passkey ini? Anda tidak akan bisa login lagi dengan passkey tersebut.")) {
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
        await throwApiError(res, "Gagal menghapus passkey.");
      }
      setSuccess("Passkey berhasil dihapus.");
      await fetchPasskeys();
    } catch (err) {
      setError(err?.message || "Gagal menghapus passkey.");
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
        await throwApiError(res, "Gagal memperbarui nama.");
      }
      setSuccess("Nama passkey berhasil diperbarui.");
      await fetchPasskeys();
    } catch (err) {
      setError(err?.message || "Gagal memperbarui nama.");
    }
  }

  function closePinModal() {
    if (registering) return;
    setShowPinModal(false);
    setPin("");
    setPinError("");
  }

  return {
    loading,
    passkeys,
    error,
    success,
    registering,
    showPinModal,
    pin,
    setPin,
    pinError,
    setPinError,
    deleting,
    webAuthnSupported,
    fetchPasskeys,
    initWebAuthnCheck,
    registerPasskey,
    confirmRegisterPasskey,
    deletePasskey,
    renamePasskey,
    closePinModal,
  };
}
