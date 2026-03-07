import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/account", "/market/chatgpt/orders"];
const ADMIN_PREFIXES = ["/admin"];
const ADMIN_PUBLIC = ["/admin/login"];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Admin routes: check has_admin presence cookie
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (ADMIN_PUBLIC.some((p) => pathname.startsWith(p))) {
      return nextWithPathname(request, pathname);
    }
    const hasAdmin = request.cookies.get("has_admin")?.value;
    if (!hasAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return nextWithPathname(request, pathname);
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

  return nextWithPathname(request, pathname);
}

/** Forward request with x-pathname header for server layout route-aware rendering. */
function nextWithPathname(request, pathname) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/market/chatgpt/orders/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
