"use client";

import { connect, disconnect, getAccount, getChainId, switchChain } from "@wagmi/core";
import { createConfig, http } from "wagmi";
import { cookieStorage, createStorage } from "wagmi";
import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const appUrl = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "https://alephdraad.app";

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

let wagmiConfigPromise;
let wagmiConfigValue;

async function createWagmiConfig() {
  const { injected, walletConnect } = await import("wagmi/connectors");

  const config = createConfig({
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
    ssr: false,
  });

  wagmiConfigValue = config;
  return config;
}

export function getCachedWagmiConfig() {
  return wagmiConfigValue;
}

export async function getWagmiConfig() {
  if (!wagmiConfigPromise) {
    wagmiConfigPromise = createWagmiConfig();
  }
  return wagmiConfigPromise;
}

export async function connectWallet(connectorId) {
  const config = await getWagmiConfig();
  const connector = config.connectors.find((c) => c.id === connectorId) || config.connectors[0];
  if (!connector) {
    throw new Error("Tidak ada konektor wallet tersedia");
  }
  const result = await connect(config, { connector });
  return result.accounts?.[0] || null;
}

export async function disconnectWallet() {
  const config = await getWagmiConfig();
  return disconnect(config);
}

export function currentAddress() {
  if (!wagmiConfigValue) return null;
  const account = getAccount(wagmiConfigValue);
  return account.address || null;
}

export async function ensureChain(targetChainId = polygonAmoy.id) {
  const config = await getWagmiConfig();
  const activeChainId = await getChainId(config);
  if (activeChainId === targetChainId) return targetChainId;
  await switchChain(config, { chainId: targetChainId });
  return targetChainId;
}
