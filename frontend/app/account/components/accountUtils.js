/**
 * Pure utility functions for the account page.
 */

export function normalizeAccountPayload(formValue = {}, socialsValue = []) {
  const normalizedSocials = (Array.isArray(socialsValue) ? socialsValue : [])
    .map((item) => ({
      label: String(item?.label || "").trim(),
      url: String(item?.url || "").trim(),
    }))
    .filter((item) => item.label || item.url);

  return {
    full_name: String(formValue.full_name || ""),
    bio: String(formValue.bio || ""),
    pronouns: String(formValue.pronouns || ""),
    company: String(formValue.company || ""),
    social_accounts: normalizedSocials,
  };
}

export function normalizeTelegramAuth(value = {}) {
  const src = value && typeof value === "object" ? value : {};
  return {
    connected: Boolean(src.connected),
    telegram_user_id: String(src.telegram_user_id || ""),
    username: String(src.username || ""),
    display_username: String(src.display_username || ""),
    deep_link: String(src.deep_link || ""),
    verified_at: String(src.verified_at || ""),
    first_name: String(src.first_name || ""),
    last_name: String(src.last_name || ""),
    photo_url: String(src.photo_url || ""),
  };
}

export function generateIdempotencyKey() {
  return crypto.randomUUID();
}
