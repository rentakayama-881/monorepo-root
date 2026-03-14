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
      color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    };
  if (s === "confirming" || s === "1")
    return { label: "Mengonfirmasi", color: "text-blue-600 bg-blue-50 border-blue-200" };
  if (s === "paid" || s === "2")
    return { label: "Terbayar", color: "text-green-600 bg-green-50 border-green-200" };
  if (s === "approved" || s === "3")
    return { label: "Berhasil", color: "text-green-700 bg-green-100 border-green-300" };
  if (s === "expired" || s === "4")
    return { label: "Kedaluwarsa", color: "text-gray-500 bg-gray-50 border-gray-200" };
  if (s === "failed" || s === "5")
    return { label: "Gagal", color: "text-red-600 bg-red-50 border-red-200" };
  if (s === "cancelled" || s === "6")
    return { label: "Dibatalkan", color: "text-gray-500 bg-gray-50 border-gray-200" };
  return { label: status, color: "text-gray-600 bg-gray-50 border-gray-200" };
}
