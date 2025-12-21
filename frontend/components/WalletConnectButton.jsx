"use client";

import { useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const buttonBase =
  "inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

function shorten(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletConnectButton() {
  const { address, isConnecting, isReconnecting, isConnected } = useAccount();
  const { connectors, connect, error: connectError, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);

  const availableConnectors = useMemo(
    () => connectors.filter((c) => c.ready),
    [connectors],
  );

  const handleConnect = async (connector) => {
    setMenuOpen(false);
    await connect({ connector });
  };

  const handleDisconnect = async () => {
    setMenuOpen(false);
    await disconnect();
  };

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={buttonBase}
          disabled={isConnecting || isReconnecting || connectStatus === "pending"}
        >
          {isConnecting || connectStatus === "pending" ? "Menyambungkan..." : "Connect Wallet"}
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-md border border-neutral-200 bg-white shadow-lg">
            <div className="py-1 text-sm text-neutral-900">
              {availableConnectors.map((connector) => (
                <button
                  key={connector.id}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 hover:bg-neutral-100"
                  onClick={() => handleConnect(connector)}
                  disabled={!connector.ready}
                >
                  <span>{connector.name}</span>
                  {!connector.ready && <span className="text-xs text-neutral-500">Tidak tersedia</span>}
                </button>
              ))}
            </div>
            {connectError && (
              <div className="border-t border-neutral-200 px-3 py-2 text-xs text-red-600">
                {connectError?.shortMessage || connectError?.message}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
        {shorten(address)}
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border border-neutral-200 bg-white shadow-lg">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
