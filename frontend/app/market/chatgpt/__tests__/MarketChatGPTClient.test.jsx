import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MarketChatGPTClient from "../MarketChatGPTClient";

const pushMock = jest.fn();
const mockFetchJsonAuth = jest.fn();
const mockGetApiBase = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: (...args) => mockFetchJsonAuth(...args),
  getApiBase: (...args) => mockGetApiBase(...args),
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

function createManyListingItems(total) {
  return Array.from({ length: total }).map((_, index) =>
    createListingItem({
      chatgpt_item_id: `chatgpt-${index + 1}`,
      title_en: `ChatGPT Plus Account ${index + 1}`,
      seller: `seller-${index + 1}`,
      published_date: 1772130072 + index,
    })
  );
}

describe("MarketChatGPTClient", () => {
  const previousConfirmSeconds = process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS = "0";

    pushMock.mockReset();
    mockFetchJsonAuth.mockReset();
    mockGetApiBase.mockReset();

    mockGetApiBase.mockReturnValue("http://localhost:8080");
    jest.useRealTimers();
    global.fetch.mockReset();
    global.fetch.mockResolvedValue(createListingResponse());
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS = previousConfirmSeconds;
  });

  it("menampilkan modal konfirmasi sebelum checkout dijalankan", async () => {
    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1-1 dari 1 akun");
    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);

    expect(await screen.findByText("Konfirmasi Pembelian")).toBeInTheDocument();
    expect(screen.getByText("Pastikan pesanan sudah benar")).toBeInTheDocument();
    expect(mockFetchJsonAuth).not.toHaveBeenCalled();
  });

  it("menampilkan feedback modal jika checkout backend menolak pembelian", async () => {
    mockFetchJsonAuth.mockRejectedValue(
      new Error("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")
    );

    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1-1 dari 1 akun");
    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);
    const confirmButton = await screen.findByRole("button", { name: /Ya, beli/i });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await screen.findByText("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Muat ulang daftar" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Tutup" })).toBeInTheDocument();
  });

  it("memuat ulang listing dari tombol refresh yang selalu terlihat", async () => {
    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1-1 dari 1 akun");

    fireEvent.click(screen.getByRole("button", { name: "Muat ulang daftar" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("memuat ulang listing otomatis setiap 60 detik", async () => {
    jest.useFakeTimers();

    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1-1 dari 1 akun");

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("mengarah ke detail order saat checkout berhasil", async () => {
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
      expect(mockFetchJsonAuth).toHaveBeenCalledWith(
        "/api/market/chatgpt/orders",
        expect.any(Object)
      );
      expect(pushMock).toHaveBeenCalledWith("/market/chatgpt/orders/order%2F123");
    });
  });

  it("menampilkan pagination 10 akun per halaman", async () => {
    global.fetch.mockResolvedValueOnce(createListingResponse(createManyListingItems(12)));

    render(<MarketChatGPTClient />);

    expect(await screen.findByText("Menampilkan 1-10 dari 12 akun")).toBeInTheDocument();
    expect(screen.queryByText("ChatGPT Plus Account 12")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));

    expect(await screen.findByText("Menampilkan 11-12 dari 12 akun")).toBeInTheDocument();
    expect(screen.getAllByText("ChatGPT Plus Account 12").length).toBeGreaterThan(0);
  });

  it("merender placeholder slot agar tinggi list stabil di halaman terakhir", async () => {
    global.fetch.mockResolvedValueOnce(createListingResponse(createManyListingItems(12)));

    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1-10 dari 12 akun");
    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    await screen.findByText("Menampilkan 11-12 dari 12 akun");

    expect(screen.getAllByTestId("market-desktop-pagination-placeholder")).toHaveLength(8);
    expect(screen.getAllByTestId("market-mobile-pagination-placeholder")).toHaveLength(8);
  });

  it("menggunakan backdrop detail standar dan bisa ditutup lewat klik backdrop", async () => {
    render(<MarketChatGPTClient />);

    const detailButtons = await screen.findAllByRole("button", { name: "Detail" });
    fireEvent.click(detailButtons[0]);

    expect(await screen.findByText("Detail Akun")).toBeInTheDocument();
    const closeOverlay = screen.getByRole("button", { name: "Tutup detail" });
    expect(closeOverlay).toHaveClass("bg-black/50");
    expect(closeOverlay).toHaveClass("transition-opacity");
    expect(closeOverlay).toHaveClass("duration-300");

    fireEvent.click(closeOverlay);

    await waitFor(() => {
      expect(screen.queryByText("Detail Akun")).not.toBeInTheDocument();
    });
  });
});
