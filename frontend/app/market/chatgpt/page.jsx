import MarketChatGPTClient from "./MarketChatGPTClient";

export const metadata = {
  title: "Marketplace Akun ChatGPT",
  description: "Jelajahi listing akun ChatGPT dan lakukan pembelian langsung di platform ini.",
  alternates: {
    canonical: "https://aivalid.id/market/chatgpt",
  },
};

export default function MarketChatGPTPage() {
  return (
    <main className="container py-10">
      <MarketChatGPTClient />
    </main>
  );
}
