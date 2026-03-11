export const MARKET_PAGE_SIZE = 10;
export const JAKARTA_TIMEZONE = "Asia/Jakarta";

export function getCheckoutConfirmSeconds() {
  const raw = Number(process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS);
  if (!Number.isFinite(raw) || raw < 0) return 60;
  return Math.floor(raw);
}

function normalizeBool(value) {
  if (value === null || value === undefined || value === "") return true;
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return true;
}

function parseUnixSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

export function formatUnixDateTime(value) {
  const seconds = parseUnixSeconds(value);
  if (!seconds) return "-";
  try {
    const formatted = new Date(seconds * 1000).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: JAKARTA_TIMEZONE,
    });
    return `${formatted} WIB`;
  } catch {
    return "-";
  }
}

export function formatUnixDate(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  try {
    return new Date(seconds * 1000).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: JAKARTA_TIMEZONE,
    });
  } catch {
    return "";
  }
}

export function boolText(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return "Ya";
  if (value === false || value === 0 || value === "0" || value === "false") return "Tidak";
  return "";
}

function hasCyrillic(s) {
  return /[\u0400-\u04FF]/.test(s);
}

function pickLatinTitle(item, index) {
  const candidates = [
    item?.title_en,
    item?.title,
    item?.name_en,
    item?.name,
    item?.account_title,
    item?.description_en,
    item?.description,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && !hasCyrillic(c)) return c.trim();
  }
  const sub = item?.chatgpt_subscription;
  if (typeof sub === "string" && sub.trim()) return `${sub.trim()} Account`;
  return `Akun ${index + 1}`;
}

export function toDisplayAccount(item, index) {
  const id =
    item?.chatgpt_item_id ?? item?.item_id ?? item?.account_id ?? item?.id ?? `row-${index}`;
  const isFallbackID = String(id).startsWith("row-");
  const seller =
    typeof item?.seller === "object" && item?.seller !== null
      ? (item?.seller?.username ??
        item?.seller?.title ??
        item?.seller?.name ??
        item?.seller?.id ??
        "-")
      : (item?.seller ?? item?.seller_name ?? item?.owner ?? "-");

  const numericPriceIDR = Number(item?.price_idr ?? 0);
  const hasIDRPrice = Number.isFinite(numericPriceIDR) && numericPriceIDR > 0;
  const normalizedIDR =
    typeof item?.display_price_idr === "string" && item.display_price_idr.trim() !== ""
      ? item.display_price_idr.trim()
      : hasIDRPrice
        ? `Rp ${numericPriceIDR.toLocaleString("id-ID")}`
        : "Harga belum tersedia";

  const uploadedAtSeconds =
    parseUnixSeconds(item?.published_date) ||
    parseUnixSeconds(item?.refreshed_date) ||
    parseUnixSeconds(item?.update_stat_date) ||
    parseUnixSeconds(item?.edit_date);

  return {
    id: String(id),
    title: pickLatinTitle(item, index),
    displayPriceIDR: normalizedIDR,
    priceSourceSymbol: item?.price_source_symbol ?? "",
    priceSourceCurrency: item?.price_source_currency ?? "",
    priceIDR: item?.price_idr ?? 0,
    status: item?.item_state ?? item?.status ?? item?.state ?? item?.availability ?? "Tersedia",
    seller,
    canBuy: normalizeBool(item?.canBuyItem) && hasIDRPrice && !isFallbackID,
    idValid: !isFallbackID,
    uploadedAtSeconds,
    uploadedAtLabel: uploadedAtSeconds ? formatUnixDateTime(uploadedAtSeconds) : "-",
    raw: item,
  };
}

export async function parseApiResponseSafe(res) {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  const text = await res.text().catch(() => "");
  return { error: text || `HTTP ${res.status}` };
}

function normalizeCheckoutErrorMessage(message) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();
  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("context canceled")
  ) {
    return "Permintaan melebihi batas waktu. Silakan coba lagi.";
  }
  if (
    lower.includes("saldo kamu tidak mencukupi") ||
    lower.includes("saldo kamu belum mencukupi") ||
    lower.includes("saldo wallet anda tidak mencukupi") ||
    lower.includes("saldo wallet anda belum mencukupi") ||
    lower.includes("insufficient") ||
    lower.includes("balance")
  ) {
    return "Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.";
  }
  if (
    lower.includes("item not found in current listing") ||
    lower.includes("item not found") ||
    lower.includes("ad not found") ||
    lower.includes("sold") ||
    lower.includes("currently unavailable") ||
    lower.includes("akun belum siap") ||
    lower.includes("account validation")
  ) {
    return "Akun saat ini belum tersedia untuk dibeli.";
  }
  return "Pembelian belum dapat diproses saat ini.";
}

export function toCheckoutFeedback(message) {
  const normalized = normalizeCheckoutErrorMessage(message);
  const lower = normalized.toLowerCase();
  const isUnavailable = lower.includes("belum tersedia") || lower.includes("tidak tersedia");

  return {
    message: normalized,
    variant: isUnavailable ? "warning" : "error",
  };
}
