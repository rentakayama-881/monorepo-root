/**
 * Shared STEPS data for Hero and HowItWorks sections.
 *
 * - `num`         — zero-padded number shown in Hero circles ("01", "02", …)
 * - `title`       — short label (used in Hero)
 * - `fullTitle`   — slightly longer label (used in HowItWorks timeline)
 * - `desc`        — brief description (Hero)
 * - `description` — fuller description (HowItWorks)
 */
export const STEPS = [
  {
    num: "01",
    title: "Buat Case & Bounty",
    fullTitle: "Buat Case",
    desc: "Owner susun case, tetapkan bounty. Saldo otomatis terpotong sebagai jaminan.",
    description:
      "Owner susun case, tetapkan bounty — saldo otomatis terpotong. Klasifikasi menggunakan tags untuk audit.",
  },
  {
    num: "02",
    title: "Validator Mengerjakan",
    fullTitle: "Validator Mengerjakan",
    desc: "Validator ajukan request, disetujui owner, lalu kerjakan. Maks 3 validator per case.",
    description:
      "Validator ajukan request, disetujui owner, lalu kerjakan. Maks 3 validator per case.",
  },
  {
    num: "03",
    title: "Confidence & Payout",
    fullTitle: "Penilaian & Payout",
    desc: "Validator terbaik berdasarkan confidence mendapat bounty. Imbang? Dibagi rata.",
    description: "Owner finalisasi. Confidence tertinggi dapat bounty. Imbang = dibagi rata.",
  },
];
