import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/account", "/market/chatgpt/orders"];
const ADMIN_PREFIXES = ["/admin"];
const ADMIN_PUBLIC = ["/admin/login"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Admin routes: check has_admin presence cookie
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (ADMIN_PUBLIC.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const hasAdmin = request.cookies.get("has_admin")?.value;
    if (!hasAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // User protected routes: check has_session presence cookie
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const hasSession = request.cookies.get("has_session")?.value;
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/market/chatgpt/orders/:path*"],
};
