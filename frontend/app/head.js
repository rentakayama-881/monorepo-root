export default function Head() {
  // Theme must be applied before first paint to avoid a "flash" of light UI
  // when the user prefers dark mode (stored in localStorage).
  return (
    <>
      <script
        id="theme-init"
        // Blocking inline script in <head> is intentional: it prevents a flash of the
        // wrong theme before React hydrates and before Tailwind variables settle.
        dangerouslySetInnerHTML={{
          __html: `(() => {
  try {
    const theme = localStorage.getItem("theme");
    const resolved =
      theme === "light" || theme === "dark"
        ? theme
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  } catch (_) {}
})();`,
        }}
      />
    </>
  );
}
