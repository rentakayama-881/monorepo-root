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
    chatgpt_subscription: "Plus",
    chatgpt_country: "US",
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

    await screen.findByText("Menampilkan 1 dari 1 akun");
    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);

    expect(await screen.findByText("Konfirmasi Pembelian")).toBeInTheDocument();
    expect(mockFetchJsonAuth).not.toHaveBeenCalled();
  });

  it("menampilkan feedback modal jika checkout backend menolak pembelian", async () => {
    mockFetchJsonAuth.mockRejectedValue(
      new Error("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")
    );

    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1 dari 1 akun");
    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);
    const confirmButton = await screen.findByRole("button", { name: /Ya, beli/i });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(
      await screen.findByText("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")
    ).toBeInTheDocument();
  });

  it("memuat ulang listing dari tombol refresh", async () => {
    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1 dari 1 akun");

    const refreshButton = screen.getByRole("button", { name: /muat ulang/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("memuat ulang listing otomatis setiap 60 detik", async () => {
    jest.useFakeTimers();

    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1 dari 1 akun");

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

  it("menampilkan semua akun tanpa pagination", async () => {
    global.fetch.mockResolvedValueOnce(createListingResponse(createManyListingItems(15)));

    render(<MarketChatGPTClient />);

    expect(await screen.findByText("Menampilkan 15 dari 15 akun")).toBeInTheDocument();
    expect(screen.getAllByText(/ChatGPT Plus Account 15/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ChatGPT Plus Account 1/).length).toBeGreaterThan(0);
  });

  it("menampilkan detail drawer dan bisa ditutup lewat klik backdrop", async () => {
    render(<MarketChatGPTClient />);

    const detailButtons = await screen.findAllByRole("button", { name: "Detail" });
    fireEvent.click(detailButtons[0]);

    expect(await screen.findByRole("dialog", { name: "Detail akun" })).toBeInTheDocument();
    const closeOverlay = screen.getByRole("button", { name: "Tutup detail" });
    fireEvent.click(closeOverlay);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Detail akun" })).not.toBeInTheDocument();
    });
  });

  it("menampilkan empty state tanpa crash saat search tidak menemukan hasil", async () => {
    render(<MarketChatGPTClient />);

    await screen.findByText("Menampilkan 1 dari 1 akun");

    const searchInput = screen.getByPlaceholderText("Cari akun...");
    fireEvent.change(searchInput, { target: { value: "xyznotfound999" } });

    expect(await screen.findByText("Belum ada akun tersedia")).toBeInTheDocument();
    expect(screen.getByText("Coba ubah kata kunci pencarian Anda.")).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Hapus pencarian" });
    fireEvent.click(clearButton);

    expect(await screen.findByText("Menampilkan 1 dari 1 akun")).toBeInTheDocument();
  });

  it("menampilkan skeleton cards saat loading", async () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<MarketChatGPTClient />);

    const skeletons = container.querySelectorAll("[aria-hidden='true']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
