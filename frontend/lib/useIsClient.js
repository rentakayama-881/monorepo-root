"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

export default function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
