"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { getCachedWagmiConfig, getWagmiConfig } from "../lib/wallet";

export default function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());
  const [wagmiConfig, setWagmiConfig] = useState(() => getCachedWagmiConfig());

  useEffect(() => {
    let mounted = true;
    getWagmiConfig().then((config) => {
      if (mounted) {
        setWagmiConfig(config);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!wagmiConfig) {
    return null;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
