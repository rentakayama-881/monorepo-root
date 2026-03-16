const readmeTemplateCoreSections = `## Case Scope
- Domain utama:
- Tahap kerja saat ini:
- Risiko jika validasi salah:

## Input Files
| File | Tujuan | Status |
| --- | --- | --- |
| [nama-file-1] | [fungsi file] | [ready/draft] |
| [nama-file-2] | [fungsi file] | [ready/draft] |

## Acceptance Criteria
- [ ] Kriteria 1
- [ ] Kriteria 2
- [ ] Kriteria 3

## Constraints
- Batas waktu:
- Tools wajib/larangan:
- Hal yang harus tetap dipertahankan:

## Sensitive Context (Filtered)
> Tulis hanya konteks sensitif yang boleh diketahui validator terpilih.
>
> Contoh: "Nama perusahaan disamarkan", "Nama kampus disingkat", "Data personal dihapus".

## Expected Validator Output
- Format hasil:
- Struktur feedback:
- Bukti validasi:
`;

export const VALIDATION_CASE_README_TEMPLATES = [
  {
    id: "academic-thesis-review",
    name: "Academic Thesis Review",
    category: "Academic",
    description:
      "Template review skripsi/tesis dengan fokus metodologi, sitasi, dan kesiapan submit.",
    previewBadges: ["Academic", "Methodology", "Citation"],
    snippet: `# [Judul Case Akademik]

![Context](https://img.shields.io/badge/Context-Academic-0891B2?style=for-the-badge)
![Focus](https://img.shields.io/badge/Focus-Methodology-2563EB?style=for-the-badge)
![Output](https://img.shields.io/badge/Output-Revision%20Ready-0E7490?style=for-the-badge)

> Template ini membantu validator memahami standar akademik yang kamu targetkan.

## Validation Goal
Jelaskan target validasi skripsi/tesis kamu secara spesifik.

## Chapter Focus
- Bab yang ingin divalidasi:
- Standar kampus/jurnal acuan:
- Titik rawan (metode, sitasi, pembahasan):

${readmeTemplateCoreSections}
`,
  },
  {
    id: "business-deck-audit",
    name: "Business Deck Audit",
    category: "Business",
    description:
      "Untuk deck presentasi klien, pitch, atau proposal bisnis dengan tolok ukur eksekutif.",
    previewBadges: ["Business", "Pitch", "Executive"],
    snippet: `# [Judul Case Business Deck]

![Context](https://img.shields.io/badge/Context-Business-059669?style=for-the-badge)
![Audience](https://img.shields.io/badge/Audience-Executive-0F766E?style=for-the-badge)
![Delivery](https://img.shields.io/badge/Delivery-Slide%20Ready-15803D?style=for-the-badge)

> Gunakan template ini saat kamu butuh validasi deck yang langsung "speak to decision maker".

## Validation Goal
Jelaskan keputusan bisnis apa yang ingin kamu dorong lewat deck ini.

## Narrative Spine
- Problem statement:
- Proposed solution:
- Value proposition:
- Call to action:

${readmeTemplateCoreSections}
`,
  },
  {
    id: "product-spec-validation",
    name: "Product Spec Validation",
    category: "Product",
    description:
      "Template untuk PRD/spec produk agar requirement, flow, dan acceptance test lebih tajam.",
    previewBadges: ["Product", "PRD", "UX Flow"],
    snippet: `# [Judul Case Product Spec]

![Context](https://img.shields.io/badge/Context-Product-7C3AED?style=for-the-badge)
![Artifact](https://img.shields.io/badge/Artifact-PRD%2FSpec-4F46E5?style=for-the-badge)
![Outcome](https://img.shields.io/badge/Outcome-Implementation%20Ready-6D28D9?style=for-the-badge)

> Cocok untuk memvalidasi dokumen requirement sebelum masuk development.

## Validation Goal
Jelaskan bagian spec apa yang paling krusial untuk diverifikasi.

## Product Boundaries
- Persona utama:
- Scope in:
- Scope out:
- Edge-case penting:

${readmeTemplateCoreSections}
`,
  },
  {
    id: "data-analysis-qc",
    name: "Data Analysis QC",
    category: "Data",
    description: "Template quality check untuk analisis data, dashboard, atau model insight.",
    previewBadges: ["Data", "QA", "Insights"],
    snippet: `# [Judul Case Data Analysis]

![Context](https://img.shields.io/badge/Context-Data%20Analysis-D97706?style=for-the-badge)
![Quality](https://img.shields.io/badge/Quality-QC%20Pass-F59E0B?style=for-the-badge)
![Output](https://img.shields.io/badge/Output-Insight%20Ready-B45309?style=for-the-badge)

> Template ini menolong validator cek akurasi, konsistensi, dan interpretasi insight.

## Validation Goal
Jelaskan keputusan apa yang akan diambil berdasarkan output analisis ini.

## Data Integrity Focus
- Sumber data:
- Periode data:
- Asumsi perhitungan:
- Potensi bias:

${readmeTemplateCoreSections}
`,
  },
  {
    id: "design-critique-studio",
    name: "Design Critique Studio",
    category: "Design",
    description: "Kerangka review visual/UI untuk website, app screen, atau brand asset.",
    previewBadges: ["Design", "UX", "Visual QA"],
    snippet: `# [Judul Case Design Review]

![Context](https://img.shields.io/badge/Context-Design-E11D48?style=for-the-badge)
![Focus](https://img.shields.io/badge/Focus-UX%20Clarity-DB2777?style=for-the-badge)
![Outcome](https://img.shields.io/badge/Outcome-Polished%20Draft-B91C1C?style=for-the-badge)

> Pakai template ini untuk validasi keterbacaan, hierarchy, dan konsistensi visual.

## Validation Goal
Jelaskan kualitas visual apa yang kamu ingin capai di output final.

## Design Lens
- Target audience:
- Brand tone:
- Problem UX yang mau diselesaikan:
- Komponen yang paling kritis:

${readmeTemplateCoreSections}
`,
  },
  {
    id: "engineering-audit-flow",
    name: "Engineering Audit Flow",
    category: "Technical",
    description:
      "Template audit teknis/code review agar validator fokus ke correctness dan risiko produksi.",
    previewBadges: ["Technical", "Audit", "Reliability"],
    snippet: `# [Judul Case Engineering Audit]

![Context](https://img.shields.io/badge/Context-Engineering-334155?style=for-the-badge)
![Review](https://img.shields.io/badge/Review-Code%20Audit-1F2937?style=for-the-badge)
![Outcome](https://img.shields.io/badge/Outcome-Ship%20Decision-475569?style=for-the-badge)

> Cocok untuk validasi hasil kerja AI pada code, query, arsitektur, atau konfigurasi sistem.

## Validation Goal
Jelaskan risiko apa yang ingin kamu minimalkan sebelum release.

## Technical Focus
- Modul terdampak:
- Potensi regression:
- Non-functional requirement:
- Monitoring yang dibutuhkan:

${readmeTemplateCoreSections}
`,
  },
  {
    id: "marketing-campaign-proof",
    name: "Marketing Campaign Proof",
    category: "Marketing",
    description: "Template untuk cek materi campaign agar messaging konsisten dan siap publish.",
    previewBadges: ["Marketing", "Campaign", "Messaging"],
    snippet: `# [Judul Case Marketing Campaign]

![Context](https://img.shields.io/badge/Context-Marketing-65A30D?style=for-the-badge)
![Focus](https://img.shields.io/badge/Focus-Messaging-16A34A?style=for-the-badge)
![Outcome](https://img.shields.io/badge/Outcome-Publish%20Ready-22C55E?style=for-the-badge)

> Gunakan untuk validasi copy, tone, CTA, dan alignment antar channel campaign.

## Validation Goal
Jelaskan objective campaign (awareness, conversion, retention, dsb).

## Campaign Context
- Target persona:
- Channel utama:
- CTA utama:
- Batasan brand/compliance:

${readmeTemplateCoreSections}
`,
  },
  {
    id: "compliance-legal-review",
    name: "Compliance Legal Review",
    category: "Compliance",
    description:
      "Template review dokumen yang sensitif terhadap aturan, disclaimer, dan jejak persetujuan.",
    previewBadges: ["Compliance", "Legal", "Risk Control"],
    snippet: `# [Judul Case Compliance Review]

![Context](https://img.shields.io/badge/Context-Compliance-4338CA?style=for-the-badge)
![Focus](https://img.shields.io/badge/Focus-Legal%20Risk-1D4ED8?style=for-the-badge)
![Outcome](https://img.shields.io/badge/Outcome-Controlled%20Release-1E40AF?style=for-the-badge)

> Template ini membantu validator menilai risiko kepatuhan dan ketepatan wording.

## Validation Goal
Jelaskan risiko legal/compliance yang harus dicegah.

## Governance Notes
- Regulasi/kebijakan acuan:
- Disclaimer wajib:
- Area yang tidak boleh diubah:
- Bukti audit trail yang diperlukan:

${readmeTemplateCoreSections}
`,
  },
];

export function getValidationCaseReadmeTemplateById(id) {
  const key = String(id || "")
    .trim()
    .toLowerCase();
  return VALIDATION_CASE_README_TEMPLATES.find((template) => template.id === key) || null;
}
