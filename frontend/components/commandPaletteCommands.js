/**
 * Command definitions for the Command Palette.
 * Each command has: id, group, title, icon, action, keywords, and optional hidden flag.
 */
export function buildCommands({ router, theme, setTheme, onClose }) {
  return [
    // Navigation
    {
      id: "nav-home",
      group: "Navigasi",
      title: "Ke Beranda",
      icon: "HOME",
      action: () => router.push("/"),
      keywords: ["home", "beranda", "dashboard"],
    },
    {
      id: "nav-case-index",
      group: "Navigasi",
      title: "Ke Daftar Case",
      icon: "INDEX",
      action: () => router.push("/validation-cases"),
      keywords: ["validation", "case", "index", "registry", "docket"],
    },
    {
      id: "nav-my-cases",
      group: "Navigasi",
      title: "Ke Case Validasi Saya",
      icon: "MINE",
      action: () => router.push("/account/validation-cases"),
      keywords: ["my", "cases", "validation", "docket"],
    },
    {
      id: "nav-smart-browser",
      group: "Navigasi",
      title: "Ke Smart Browser",
      icon: "BROWSER",
      action: () => router.push("/cloud-browser"),
      keywords: ["browser", "cloud", "anti-detect", "smart", "profil"],
    },
    {
      id: "nav-about",
      group: "Navigasi",
      title: "Ke Tentang",
      icon: "ABOUT",
      action: () => router.push("/about-content"),
      keywords: ["about", "tentang"],
    },
    {
      id: "nav-rules",
      group: "Navigasi",
      title: "Ke Aturan",
      icon: "RULES",
      action: () => router.push("/rules-content"),
      keywords: ["rules", "aturan", "peraturan"],
    },
    {
      id: "nav-account",
      group: "Navigasi",
      title: "Ke Pengaturan",
      icon: "SET",
      action: () => router.push("/account"),
      keywords: ["settings", "pengaturan", "account", "akun"],
    },

    // Actions
    {
      id: "action-search",
      group: "Aksi",
      title: "Cari",
      icon: "FIND",
      action: () => {
        onClose();
        setTimeout(() => {
          const searchInput = document.querySelector('input[type="search"]');
          if (searchInput) searchInput.focus();
        }, 100);
      },
      keywords: ["search", "cari", "find", "filter"],
    },
    {
      id: "action-theme-light",
      group: "Aksi",
      title: "Pakai Mode Terang",
      icon: "LIGHT",
      action: () => setTheme("light"),
      keywords: ["theme", "light", "terang", "bright"],
      hidden: theme === "light",
    },
    {
      id: "action-theme-dark",
      group: "Aksi",
      title: "Pakai Mode Gelap",
      icon: "DARK",
      action: () => setTheme("dark"),
      keywords: ["theme", "dark", "gelap", "night"],
      hidden: theme === "dark",
    },
    {
      id: "action-theme-system",
      group: "Aksi",
      title: "Ikuti Tema Sistem",
      icon: "AUTO",
      action: () => setTheme("system"),
      keywords: ["theme", "system", "auto", "sistem"],
      hidden: theme === "system",
    },
  ];
}
