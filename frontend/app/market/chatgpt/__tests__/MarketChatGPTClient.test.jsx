import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function renderMarket(cache = new Map()) {
  return render(<MarketChatGPTClient />, {
    wrapper: function Wrapper({ children }) {
      return (
        <SWRConfig
          value={{
            provider: () => cache,
            dedupingInterval: 0,
            focusThrottleInterval: 0,
            errorRetryCount: 0,
            errorRetryInterval: 0,
          }}
        >
          {children}
        </SWRConfig>
      );
    },
  });
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
    renderMarket();

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

    renderMarket();

    const buyButtons = await screen.findAllByRole("button", { name: "Beli" });
    fireEvent.click(buyButtons[0]);
    const confirmButton = await screen.findByRole("button", { name: /Ya, beli/i });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    fireEvent.click(confirmButton);

    expect(mockFetchFeatureAuth).toHaveBeenCalledWith("/api/v1/wallets/me");

    expect(
      await screen.findByText("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Muat ulang daftar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutup" })).toBeInTheDocument();
  });

  it("memuat ulang listing dari modal feedback", async () => {
    mockFetchFeatureAuth.mockResolvedValue({ data: { balance: 0 } });
    mockUnwrapFeatureData.mockReturnValue({ balance: 0 });

    renderMarket();

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
      expect(
        screen.queryByText("Saldo wallet Anda belum mencukupi untuk melanjutkan pembelian.")
      ).not.toBeInTheDocument();
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

    renderMarket();

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

    renderMarket();

    expect(await screen.findByText("Menampilkan 1-10 dari 12 akun")).toBeInTheDocument();
    expect(screen.queryByText("ChatGPT Plus Account 12")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));

    expect(await screen.findByText("Menampilkan 11-12 dari 12 akun")).toBeInTheDocument();
    expect(screen.getAllByText("ChatGPT Plus Account 12").length).toBeGreaterThan(0);
  });

  it("merender placeholder slot agar tinggi list stabil di halaman terakhir", async () => {
    global.fetch.mockResolvedValueOnce(createListingResponse(createManyListingItems(12)));

    renderMarket();

    await screen.findByText("Menampilkan 1-10 dari 12 akun");
    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    await screen.findByText("Menampilkan 11-12 dari 12 akun");

    expect(screen.getAllByTestId("market-desktop-pagination-placeholder")).toHaveLength(8);
    expect(screen.getAllByTestId("market-mobile-pagination-placeholder")).toHaveLength(8);
  });

  it("menggunakan backdrop detail standar dan bisa ditutup lewat klik backdrop", async () => {
    renderMarket();

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

  it("tidak merender empty state saat initial request masih pending", () => {
    const deferred = createDeferred();
    global.fetch.mockImplementationOnce(() => deferred.promise);

    renderMarket();

    expect(screen.queryByText("Belum ada akun untuk ditampilkan")).not.toBeInTheDocument();
    expect(screen.queryByText("Belum ada akun untuk ditampilkan.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Belum ada akun yang cocok dengan pencarian Anda.")
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("mempertahankan data sebelumnya saat remount memicu revalidate background", async () => {
    const sharedCache = new Map();
    const deferred = createDeferred();
    global.fetch
      .mockResolvedValueOnce(createListingResponse())
      .mockImplementationOnce(() => deferred.promise);

    const firstRender = renderMarket(sharedCache);
    await screen.findByText("Menampilkan 1-1 dari 1 akun");
    firstRender.unmount();

    renderMarket(sharedCache);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(screen.getAllByText("ChatGPT Plus Account").length).toBeGreaterThan(0);
    expect(screen.getByText("Daftar sedang diperbarui...")).toBeInTheDocument();
    expect(screen.queryByText("Belum ada akun untuk ditampilkan")).not.toBeInTheDocument();
    expect(screen.queryByText("Belum ada akun untuk ditampilkan.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Belum ada akun yang cocok dengan pencarian Anda.")
    ).not.toBeInTheDocument();
  });

  it("menampilkan empty state base hanya setelah response sukses kosong", async () => {
    global.fetch.mockResolvedValueOnce(createListingResponse([]));

    renderMarket();

    expect(await screen.findByText("Belum ada akun untuk ditampilkan.")).toBeInTheDocument();
    expect(
      screen.queryByText("Belum ada akun yang cocok dengan pencarian Anda.")
    ).not.toBeInTheDocument();
  });

  it("menampilkan empty state pencarian jika data dasar ada tetapi filter tidak cocok", async () => {
    renderMarket();

    await screen.findByText("Menampilkan 1-1 dari 1 akun");
    fireEvent.change(
      screen.getByPlaceholderText("Cari judul, penjual, status, atau waktu upload..."),
      {
        target: { value: "tidak-cocok" },
      }
    );

    expect(
      await screen.findByText("Belum ada akun yang cocok dengan pencarian Anda.")
    ).toBeInTheDocument();
    expect(screen.getByText("0 hasil dari 1 akun")).toBeInTheDocument();
    expect(screen.queryByText("Belum ada akun untuk ditampilkan.")).not.toBeInTheDocument();
  });

  it("menampilkan error state jika payload sukses tidak sesuai kontrak", async () => {
    const malformedPayload = { items: [createListingItem()] };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: () => "application/json",
      },
      json: jest.fn().mockResolvedValue(malformedPayload),
      text: jest.fn().mockResolvedValue(JSON.stringify(malformedPayload)),
    });

    renderMarket();

    expect(await screen.findByText("Respons daftar akun tidak valid.")).toBeInTheDocument();
    expect(screen.queryByText("Belum ada akun untuk ditampilkan")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Belum ada akun yang cocok dengan pencarian Anda.")
    ).not.toBeInTheDocument();
  });
});
