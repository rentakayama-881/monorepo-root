import OrderDetailClient from "./OrderDetailClient";

export const metadata = {
  title: "Detail Pembelian",
  description: "Lihat status dan detail akun yang berhasil dibeli di marketplace AIValid.",
  robots: { index: false, follow: false },
};

export default function MarketOrderPage() {
  return <OrderDetailClient />;
}
