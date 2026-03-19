import { TonIcon, UsdtIcon } from "@/components/wallet/CryptoIcons";
import { unwrapFeatureData } from "@/lib/featureApi";

export const CRYPTO_OPTIONS = [
  {
    value: "USDT",
    label: "Tether",
    symbol: "USDT",
    networks: ["TRC20", "TON", "BEP20", "ERC20", "Polygon", "SOL"],
    icon: <UsdtIcon />,
  },
  {
    value: "TON",
    label: "Toncoin",
    symbol: "TON",
    networks: ["TON"],
    icon: <TonIcon />,
  },
];

export const quickAmounts = [2000, 5000, 10000, 50000, 100000];
export const minDeposit = 2000;

const NETWORK_DISPLAY_MAP = {
  "tron network": "TRC20",
  "ton network": "TON",
  "bsc mainnet": "BEP20",
  "ethereum mainnet": "ERC20",
  "polygon mainnet": "Polygon",
  "solana mainnet": "SOL",
};

export function normalizeNetworkName(oxaPayNetwork) {
  if (!oxaPayNetwork) return "";
  return NETWORK_DISPLAY_MAP[oxaPayNetwork.toLowerCase()] || oxaPayNetwork;
}

export function normalizeWallet(payload) {
  const data = unwrapFeatureData(payload) || {};
  const balanceRaw =
    data.balance ?? data.Balance ?? data.availableBalance ?? data.AvailableBalance ?? 0;
  const pinSetRaw =
    data.pinSet ?? data.PinSet ?? data.pin_set ?? data.hasPin ?? data.has_pin ?? false;
  return {
    balance: Number(balanceRaw) || 0,
    has_pin: Boolean(pinSetRaw),
  };
}

export function normalizeDeposit(item) {
  return {
    id: item?.id ?? item?.Id ?? "",
    amount: Number(item?.amount ?? item?.Amount ?? 0) || 0,
    payCurrency: item?.payCurrency ?? item?.PayCurrency ?? "",
    payAmount: item?.payAmount ?? item?.PayAmount ?? "",
    network: item?.network ?? item?.Network ?? "",
    status: item?.status ?? item?.Status ?? "WaitingPayment",
    createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
    platformFee: Number(item?.platformFee ?? item?.PlatformFee ?? 0) || 0,
  };
}

export function getStatusLabel(status) {
  const s = String(status).toLowerCase();
  if (s === "waitingpayment" || s === "waiting_payment" || s === "0")
    return {
      label: "Menunggu Pembayaran",
      color: "text-status-amber-text bg-status-amber-bg border-status-amber-border",
    };
  if (s === "confirming" || s === "1")
    return {
      label: "Mengonfirmasi",
      color: "text-status-info-text bg-status-info-bg border-status-info-border",
    };
  if (s === "paid" || s === "2")
    return {
      label: "Terbayar",
      color: "text-status-success-text bg-status-success-bg border-status-success-border",
    };
  if (s === "approved" || s === "3")
    return {
      label: "Berhasil",
      color: "text-status-success-text bg-status-success-bg border-status-success-border",
    };
  if (s === "expired" || s === "4")
    return { label: "Kedaluwarsa", color: "text-muted-foreground bg-muted border-border" };
  if (s === "failed" || s === "5")
    return {
      label: "Gagal",
      color: "text-status-danger-text bg-status-danger-bg border-status-danger-border",
    };
  if (s === "cancelled" || s === "6")
    return { label: "Dibatalkan", color: "text-muted-foreground bg-muted border-border" };
  return { label: status, color: "text-muted-foreground bg-muted border-border" };
}
