"use client";

import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";

export default function ApiStatusBanner() {
  const [healthy, setHealthy] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    const ping = async () => {
      try {
        await fetchHealth();
        if (!cancelled) {
          setHealthy(true);
          setChecked(true);
        }
      } catch (err) {
        if (!cancelled) {
          setHealthy(false);
          setChecked(true);
        }
      }
    };

    ping();
    intervalId = setInterval(ping, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (healthy && checked) return null;
  if (healthy && !checked) return null;

  return (
    <div className="mt-[4.5rem] w-full bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-2 text-xs sm:text-sm font-medium text-center">
        Reconnecting…
      </div>
    </div>
  );
}
