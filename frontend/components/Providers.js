"use client";

import { SWRConfig } from "swr";
import { swrConfig } from "@/lib/swr";
import { UserProvider } from "@/lib/UserContext";

/**
 * Providers component - wraps app with all necessary context providers
 * Includes SWR configuration and UserContext
 */
export function Providers({ children }) {
  return (
    <SWRConfig value={swrConfig}>
      <UserProvider>
        {children}
      </UserProvider>
    </SWRConfig>
  );
}

export default Providers;
