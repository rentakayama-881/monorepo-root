"use client";

import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { cookieStorage, createStorage } from "wagmi";
import { defineChain } from "viem";
import { connect, disconnect, getAccount, getChainId, switchChain } from "@wagmi/core";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
const appUrl = typeof window !== "undefined" ? window.location.origin : "https://alephdraad.app";

export const polygonAmoy = defineChain({
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: "PolygonScan", url: "https://amoy.polygonscan.com" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  transports: {
    [polygonAmoy.id]: http(rpcUrl),
  },
  connectors: [
    injected({ shimDisconnect: true }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
              name: "Alephdraad",
              description: "Alephdraad escrow",
              url: appUrl,
              icons: [`${appUrl}/favicon.ico`],
            },
          }),
        ]
      : []),
  ],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});

export async function connectWallet(connectorId) {
  const connector = wagmiConfig.connectors.find((c) => c.id === connectorId) || wagmiConfig.connectors[0];
  if (!connector) {
    throw new Error("Tidak ada konektor wallet tersedia");
  }
  const result = await connect(wagmiConfig, { connector });
  return result.accounts?.[0] || null;
}

export async function disconnectWallet() {
  return disconnect(wagmiConfig);
}

export function currentAddress() {
  const account = getAccount(wagmiConfig);
  return account.address || null;
}

export async function ensureChain(targetChainId = polygonAmoy.id) {
  const activeChainId = await getChainId(wagmiConfig);
  if (activeChainId === targetChainId) return targetChainId;
  await switchChain(wagmiConfig, { chainId: targetChainId });
  return targetChainId;
}
