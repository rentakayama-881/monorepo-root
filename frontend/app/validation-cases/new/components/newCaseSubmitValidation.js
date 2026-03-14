/**
 * Validation logic for new validation case submission.
 * Extracted from useNewValidationCase.js for modularity.
 */

import {
  checklistItems,
  sensitivityOptions,
  titleMinLength,
  titleMaxLength,
  getTagDimensionFromSlug,
} from "./newCaseUtils";

/**
 * Normalize selected tags into unique lowercase slugs.
 */
export function normalizeTagSlugs(selectedTags) {
  return Array.from(
    new Set(
      selectedTags
        .map((t) =>
          String(t?.slug || "")
            .toLowerCase()
            .trim()
        )
        .filter(Boolean)
    )
  );
}

/**
 * Validate new case form before submission.
 * Returns an error string if invalid, or null if valid.
 */
export function validateNewCaseSubmit({
  caseType,
  locked,
  telegramGateLocked,
  title,
  bounty,
  sensitivity,
  caseRecord,
  normalizedTagSlugs,
  checklist,
}) {
  if (!caseType?.slug) {
    return "Konfigurasi intake belum siap. Hubungi admin.";
  }

  if (locked) {
    return "Intake sedang ditutup.";
  }

  if (telegramGateLocked) {
    return "Sebelum membuat Validation Case, sambungkan akun Telegram terverifikasi di Account Settings.";
  }

  if (title.length < titleMinLength) {
    return `Title minimal ${titleMinLength} karakter.`;
  }

  if (title.length > titleMaxLength) {
    return `Title maksimal ${titleMaxLength} karakter.`;
  }

  if (!bounty || bounty < 10000) {
    return "Bounty minimal Rp 10.000.";
  }

  if (!Number.isSafeInteger(bounty)) {
    return "Nominal bounty terlalu besar.";
  }

  if (!sensitivityOptions.includes(sensitivity)) {
    return "Sensitivitas harus S0, S1, S2, atau S3.";
  }

  if (!caseRecord) {
    return "Case Record wajib diisi.";
  }

  if (/t\.me\/|telegram|wa\.me\/|whatsapp/i.test(caseRecord)) {
    return "Case Record tidak boleh memuat kontak langsung.";
  }

  if (normalizedTagSlugs.length < 2 || normalizedTagSlugs.length > 4) {
    return "Tags wajib minimal 2 dan maksimal 4 sesuai taxonomy.";
  }

  const seenDimensions = new Map();
  for (const slug of normalizedTagSlugs) {
    const dim = getTagDimensionFromSlug(slug);
    if (!dim) continue;
    const existing = seenDimensions.get(dim);
    if (existing) {
      return `Tag dimensi '${dim}' hanya boleh satu (${existing} dan ${slug}).`;
    }
    seenDimensions.set(dim, slug);
  }

  const unchecked = checklistItems.find((it) => !Boolean(checklist?.[it.key]));
  if (unchecked) {
    return "Checklist protokol wajib dilengkapi sebelum submit.";
  }

  return null;
}
