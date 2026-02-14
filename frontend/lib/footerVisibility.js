const HIDE_FOOTER_EXACT = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/set-username",
  "/validation-cases/new",
  "/documents/upload",
  "/components-demo",
  "/sync-token",
]);

const HIDE_FOOTER_PREFIXES = ["/admin", "/account"];

export function shouldHideFooter(pathname) {
  if (!pathname) return false;
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (HIDE_FOOTER_EXACT.has(normalized)) return true;
  return HIDE_FOOTER_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}
