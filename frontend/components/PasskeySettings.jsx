"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/api";
import { base64URLToBuffer, serializePublicKeyCredential } from "@/lib/webauthn";

// Check if WebAuthn is supported
function isWebAuthnSupported() {
  return ! !(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === "function"
  );
}

// SVG Icons Component
const Icons = {
  // Main passkey/key icon (seperti icon key di GitHub)
  passkey: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  ),
  // Internal/biometric (fingerprint/face) - smartphone icon
  internal: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  // USB security key
  usb: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15. 75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      <circle cx="16.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  ),
  // NFC
  nfc: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0" />
      <circle cx="12" cy="18" r="1. 5" fill="currentColor" />
    </svg>
  ),
  // Bluetooth
  bluetooth: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l10 10-5 5V2l5 5L7 17" />
    </svg>
  ),
  // Default/unknown - lock icon
  default: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16. 5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  // Warning icon
  warning: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h. 01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-. 77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  // Plus icon
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
};

export default function PasskeySettings() {
  const [loading, setLoading] = useState(true);
  const [passkeys, setPasskeys] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registering, setRegistering] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [newName, setNewName] = useState("");
  const [webAuthnSupported, setWebAuthnSupported] = useState(true);

  const API = `${getApiBase()}/api/auth/passkeys`;

  const fetchPasskeys = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat passkeys");
      const data = await res.json();
      setPasskeys(data. passkeys || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
    fetchPasskeys();
  }, [fetchPasskeys]);

  async function registerPasskey() {
    if (!isWebAuthnSupported()) {
      setError("Browser Anda tidak mendukung Passkey/WebAuthn");
      return;
    }

    setRegistering(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");

      // 1. Begin registration - get options from server
      const beginRes = await fetch(`${API}/register/begin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!beginRes.ok) {
        const errData = await beginRes.json();
        throw new Error(errData.error || "Gagal memulai registrasi");
      }
      const { options } = await beginRes.json();

      // 2. Convert options for WebAuthn API
      const publicKeyOptions = options.publicKey;

      // Convert challenge from base64url to ArrayBuffer
      publicKeyOptions.challenge = base64URLToBuffer(publicKeyOptions.challenge);

      // Convert user. id from base64url to ArrayBuffer
      publicKeyOptions.user.id = base64URLToBuffer(publicKeyOptions.user.id);

      // Convert excludeCredentials if present
      if (publicKeyOptions. excludeCredentials) {
        publicKeyOptions.excludeCredentials = publicKeyOptions.excludeCredentials.map((cred) => ({
          ... cred,
          id: base64URLToBuffer(cred.id),
        }));
      }

      // 3. Create credential using WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });

      if (!credential) {
        throw new Error("Registrasi dibatalkan");
      }

      // 4.  Prepare response for server
      const credentialForServer = serializePublicKeyCredential(credential);

      // Prompt for passkey name
      const passkeyName = prompt("Beri nama untuk passkey ini:", "Passkey") || "Passkey";

      // 5. Finish registration - send credential to server
      const finishRes = await fetch(`${API}/register/finish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: passkeyName,
          credential: credentialForServer,
        }),
      });

      if (!finishRes.ok) {
        const errData = await finishRes.json();
        throw new Error(errData. error || "Gagal menyelesaikan registrasi");
      }

      setSuccess("Passkey berhasil didaftarkan!");
      fetchPasskeys();
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Registrasi dibatalkan atau tidak diizinkan");
      } else if (err.name === "InvalidStateError") {
        setError("Passkey ini sudah terdaftar");
      } else {
        setError(err.message || "Gagal mendaftarkan passkey");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function deletePasskey(id) {
    if (!confirm("Hapus passkey ini? Anda tidak dapat login dengan passkey ini lagi.")) {
      return;
    }

    setDeleting(id);
    setError("");
    setSuccess("");

    try {
      const token = localStorage. getItem("token");
      const res = await fetch(`${API}/${id}`, {
        method: "DELETE",
        headers: { Authorization:  `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal menghapus passkey");
      }
      setSuccess("Passkey berhasil dihapus");
      fetchPasskeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  async function renamePasskey(id) {
    if (!newName.trim()) {
      setError("Nama tidak boleh kosong");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/${id}/name`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName. trim() }),
      });
      if (!res.ok) {
        const errData = await res. json();
        throw new Error(errData.error || "Gagal mengubah nama");
      }
      setSuccess("Nama passkey berhasil diubah");
      setRenaming(null);
      setNewName("");
      fetchPasskeys();
    } catch (err) {
      setError(err.message);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getTransportIcon(transports) {
    if (!transports || transports.length === 0) return Icons.default;
    if (transports.includes("internal")) return Icons.internal;
    if (transports.includes("usb")) return Icons.usb;
    if (transports.includes("nfc")) return Icons.nfc;
    if (transports.includes("ble")) return Icons.bluetooth;
    return Icons.default;
  }

  function getTransportLabel(transports) {
    if (!transports || transports.length === 0) return "Unknown";
    if (transports. includes("internal")) return "Built-in Authenticator";
    if (transports.includes("usb")) return "USB Security Key";
    if (transports.includes("nfc")) return "NFC";
    if (transports.includes("ble")) return "Bluetooth";
    return "Passkey";
  }

  if (! webAuthnSupported) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          {Icons.passkey}
          Passkeys
        </h3>
        <div className="mt-3 p-3 rounded-md bg-amber-600/10 border border-amber-600/30">
          <div className="flex items-start gap-2">
            <span className="text-amber-600">{Icons.warning}</span>
            <p className="text-sm text-amber-600">
              Browser Anda tidak mendukung Passkey/WebAuthn.  Gunakan browser modern seperti Chrome, Firefox, Safari, atau Edge versi terbaru.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          {Icons.passkey}
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
        <div className="mt-3 p-2 rounded-md bg-emerald-600/10 border border-emerald-600/30 text-sm text-emerald-600">
          {success}
        </div>
      )}

      {loading ?  (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          Memuat... 
        </div>
      ) : (
        <>
          {/* Passkey List */}
          {passkeys.length > 0 && (
            <div className="mt-4 space-y-2">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-muted-foreground"
                      title={getTransportLabel(pk.transports)}
                    >
                      {getTransportIcon(pk. transports)}
                    </span>
                    <div>
                      {renaming === pk.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-32 px-2 py-1 text-sm rounded border border-border bg-card text-foreground"
                            placeholder="Nama baru"
                            autoFocus
                          />
                          <button
                            onClick={() => renamePasskey(pk.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => {
                              setRenaming(null);
                              setNewName("");
                            }}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">{pk.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Dibuat: {formatDate(pk. created_at)}
                            {pk.last_used_at && ` • Terakhir:  ${formatDate(pk.last_used_at)}`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renaming !== pk.id && (
                      <>
                        <button
                          onClick={() => {
                            setRenaming(pk.id);
                            setNewName(pk.name);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Ubah nama
                        </button>
                        <button
                          onClick={() => deletePasskey(pk.id)}
                          disabled={deleting === pk.id}
                          className="text-xs text-destructive hover:underline disabled:opacity-50"
                        >
                          {deleting === pk. id ? "Menghapus..." : "Hapus"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Register Button */}
          <div className="mt-4">
            <button
              onClick={registerPasskey}
              disabled={registering}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:opacity-90 disabled:opacity-50"
            >
              {registering ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Mendaftarkan...
                </>
              ) : (
                <>
                  {Icons.plus}
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
  );
}
