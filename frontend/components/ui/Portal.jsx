"use client";

import { createPortal } from "react-dom";
import useIsClient from "@/lib/useIsClient";

export default function Portal({ children }) {
  const isClient = useIsClient();
  if (!isClient) return null;

  return createPortal(children, document.body);
}
