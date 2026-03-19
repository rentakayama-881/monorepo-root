"use client";

import { useEffect } from "react";
import usePasskeySettings from "./usePasskeySettings";
import PasskeyList from "./PasskeyList";
import PasskeyPinModal from "./PasskeyPinModal";
import { SectionLoadingBlock } from "./ui/LoadingState";

const PasskeyIcon = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
    />
  </svg>
);

const WarningIcon = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const PlusIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

export default function PasskeySettings() {
  const {
    loading,
    passkeys,
    error,
    success,
    registering,
    showPinModal,
    pin,
    setPin,
    pinError,
    deleting,
    webAuthnSupported,
    fetchPasskeys,
    initWebAuthnCheck,
    registerPasskey,
    confirmRegisterPasskey,
    deletePasskey,
    renamePasskey,
    closePinModal,
  } = usePasskeySettings();

  useEffect(() => {
    initWebAuthnCheck();
    fetchPasskeys();
  }, [fetchPasskeys, initWebAuthnCheck]);

  if (!webAuthnSupported) {
    return (
      <section className="settings-section">
        <h3 className="settings-section-title flex items-center gap-2">
          {PasskeyIcon}
          Passkeys
        </h3>
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20">
          <div className="flex items-start gap-2">
            <span className="text-warning">{WarningIcon}</span>
            <p className="text-sm text-warning">
              Browser Anda belum mendukung Passkey/WebAuthn. Gunakan browser modern seperti Chrome,
              Firefox, Safari, atau Edge versi terbaru.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="settings-section">
        <div className="flex items-center justify-between">
          <h3 className="settings-section-title flex items-center gap-2">
            {PasskeyIcon}
            Passkeys
          </h3>
          <span className="text-xs text-muted-foreground">{passkeys.length} terdaftar</span>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Passkeys memungkinkan Anda login tanpa password menggunakan fingerprint, face ID, atau
          kunci keamanan.
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
            <SectionLoadingBlock lines={2} compact srLabel="Memuat passkey" />
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
        <PasskeyPinModal
          pin={pin}
          onPinChange={setPin}
          pinError={pinError}
          registering={registering}
          onConfirm={confirmRegisterPasskey}
          onClose={closePinModal}
        />
      )}
    </>
  );
}
