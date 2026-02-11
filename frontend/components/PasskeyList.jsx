"use client";

import { useState } from "react";

// Transport Icons
const TransportIcons = {
  internal: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  usb: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      <circle cx="16.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  ),
  nfc: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
    </svg>
  ),
  bluetooth: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l10 10-5 5V2l5 5L7 17" />
    </svg>
  ),
  default: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
};

function getTransportIcon(transports) {
  if (!transports || transports.length === 0) return TransportIcons.default;
  if (transports.includes("internal")) return TransportIcons.internal;
  if (transports.includes("usb")) return TransportIcons.usb;
  if (transports.includes("nfc")) return TransportIcons.nfc;
  if (transports.includes("ble")) return TransportIcons.bluetooth;
  return TransportIcons.default;
}

function getTransportLabel(transports) {
  if (!transports || transports.length === 0) return "Unknown";
  if (transports.includes("internal")) return "Built-in Authenticator";
  if (transports.includes("usb")) return "USB Security Key";
  if (transports.includes("nfc")) return "NFC";
  if (transports.includes("ble")) return "Bluetooth";
  return "Passkey";
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

export default function PasskeyList({ passkeys, onDelete, onRename, deleting }) {
  const [renaming, setRenaming] = useState(null);
  const [newName, setNewName] = useState("");

  function handleRename(id) {
    if (!newName.trim()) return;
    onRename(id, newName.trim());
    setRenaming(null);
    setNewName("");
  }

  if (passkeys.length === 0) return null;

  return (
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
              {getTransportIcon(pk.transports)}
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
                    onClick={() => handleRename(pk.id)}
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
                    Dibuat: {formatDate(pk.created_at)}
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
                  onClick={() => onDelete(pk.id)}
                  disabled={deleting === pk.id}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  {deleting === pk.id ? "Menghapus..." : "Hapus"}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
