import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MarketChatGPTClient from "../MarketChatGPTClient";

const pushMock = jest.fn();
const mockFetchJsonAuth = jest.fn();
const mockGetApiBase = jest.fn();
const mockFetchFeatureAuth = jest.fn();
const mockUnwrapFeatureData = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: (...args) => mockFetchJsonAuth(...args),
  getApiBase: (...args) => mockGetApiBase(...args),
}));

jest.mock("@/lib/featureApi", () => ({
  FEATURE_ENDPOINTS: {
    WALLETS: {
      ME: "/api/v1/wallets/me",
    },
  },
  fetchFeatureAuth: (...args) => mockFetchFeatureAuth(...args),
  unwrapFeatureData: (...args) => mockUnwrapFeatureData(...args),
}));

function createListingItem(overrides = {}) {
  return {
    chatgpt_item_id: "chatgpt-01",
    title_en: "ChatGPT Plus Account",
    price_idr: 150000,
    seller: "seller-1",
    canBuyItem: true,
    item_state: "Available",
    published_date: 1772130072,
    ...overrides,
  };
}

function createListingResponse(items = [createListingItem()]) {
  const payload = { json: { items } };
  return {
    ok: true,
    status: 200,
    headers: {
      get: () => "application/json",
    },
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}

describe("MarketChatGPTClient", () => {
  const previousConfirmSeconds = process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS = "0";

    pushMock.mockReset();
    mockFetchJsonAuth.mockReset();
    mockGetApiBase.mockReset();
    mockFetchFeatureAuth.mockReset();
    mockUnwrapFeatureData.mockReset();

    mockGetApiBase.mockReturnValue("http://localhost:8080");
    global.fetch.mockReset();
    global.fetch.mockResolvedValue(createListingResponse());
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS = previousConfirmSeconds;
  });

  it("menampilkan modal konfirmasi sebelum checkout dijalankan", async () => {
    render(<MarketChatGPTClient />);

    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);

    expect(await screen.findByText("Konfirmasi Pembelian")).toBeInTheDocument();
    expect(screen.getByText("Pastikan pesanan sudah benar")).toBeInTheDocument();
    expect(mockFetchFeatureAuth).not.toHaveBeenCalled();
    expect(mockFetchJsonAuth).not.toHaveBeenCalled();
  });

  it("menampilkan feedback modal jika saldo wallet tidak cukup", async () => {
    mockFetchFeatureAuth.mockResolvedValue({ data: { balance: 0 } });
    mockUnwrapFeatureData.mockReturnValue({ balance: 0 });

    render(<MarketChatGPTClient />);

    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);
    const confirmButton = await screen.findByRole("button", { name: /Ya, beli/i });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(mockFetchFeatureAuth).toHaveBeenCalledWith("/api/v1/wallets/me");

    expect(await screen.findByText("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Muat ulang daftar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutup" })).toBeInTheDocument();
  });

  it("memuat ulang listing dari modal feedback", async () => {
    mockFetchFeatureAuth.mockResolvedValue({ data: { balance: 0 } });
    mockUnwrapFeatureData.mockReturnValue({ balance: 0 });

    render(<MarketChatGPTClient />);

    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);
    const confirmButton = await screen.findByRole("button", { name: /Ya, beli/i });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await screen.findByText("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.");

    fireEvent.click(screen.getByRole("button", { name: "Muat ulang daftar" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.queryByText("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")).not.toBeInTheDocument();
    });
  });

  it("mengarah ke detail order saat checkout berhasil", async () => {
    mockFetchFeatureAuth.mockResolvedValue({ data: { balance: 150000 } });
    mockUnwrapFeatureData.mockReturnValue({ balance: 150000 });
    mockFetchJsonAuth.mockResolvedValue({
      order: {
        id: "order/123",
      },
    });

    render(<MarketChatGPTClient />);

    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);
    const confirmButton = await screen.findByRole("button", { name: /Ya, beli/i });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockFetchJsonAuth).toHaveBeenCalledWith("/api/market/chatgpt/orders", expect.any(Object));
      expect(pushMock).toHaveBeenCalledWith("/market/chatgpt/orders/order%2F123");
    });
  });
});
