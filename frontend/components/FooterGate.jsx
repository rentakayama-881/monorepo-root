"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import { shouldHideFooter } from "@/lib/footerVisibility";

export default function FooterGate() {
  const pathname = usePathname() || "";

  if (shouldHideFooter(pathname)) {
    return null;
  }

  return <Footer />;
}
