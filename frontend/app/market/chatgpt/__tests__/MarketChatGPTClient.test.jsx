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
    title: "ChatGPT Pro Account",
    price_idr: 150000,
    seller: "seller-1",
    canBuyItem: true,
    item_state: "Available",
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
  beforeEach(() => {
    pushMock.mockReset();
    mockFetchJsonAuth.mockReset();
    mockGetApiBase.mockReset();
    mockFetchFeatureAuth.mockReset();
    mockUnwrapFeatureData.mockReset();

    mockGetApiBase.mockReturnValue("http://localhost:8080");
    global.fetch.mockReset();
    global.fetch.mockResolvedValue(createListingResponse());
  });

  it("shows checkout feedback in modal when balance is insufficient", async () => {
    mockFetchFeatureAuth.mockResolvedValue({ data: { balance: 0 } });
    mockUnwrapFeatureData.mockReturnValue({ balance: 0 });

    render(<MarketChatGPTClient />);

    const buyButton = await screen.findByRole("button", { name: "Buy" });
    fireEvent.click(buyButton);

    expect(mockFetchFeatureAuth).toHaveBeenCalledWith("/api/v1/wallets/me");

    const modalTitle = await screen.findByText("Insufficient balance");
    expect(modalTitle).toBeInTheDocument();
    expect(screen.getByText("Your balance is insufficient.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh listings" })).toBeInTheDocument();
  });

  it("refreshes listings from modal action and closes modal on success", async () => {
    mockFetchFeatureAuth.mockResolvedValue({ data: { balance: 0 } });
    mockUnwrapFeatureData.mockReturnValue({ balance: 0 });

    render(<MarketChatGPTClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Buy" }));
    await screen.findByText("Insufficient balance");

    fireEvent.click(screen.getByRole("button", { name: "Refresh listings" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.queryByText("Insufficient balance")).not.toBeInTheDocument();
    });
  });

  it("redirects to order detail when checkout succeeds", async () => {
    mockFetchFeatureAuth.mockResolvedValue({ data: { balance: 150000 } });
    mockUnwrapFeatureData.mockReturnValue({ balance: 150000 });
    mockFetchJsonAuth.mockResolvedValue({
      order: {
        id: "order/123",
      },
    });

    render(<MarketChatGPTClient />);

    fireEvent.click(await screen.findByRole("button", { name: "Buy" }));

    await waitFor(() => {
      expect(mockFetchJsonAuth).toHaveBeenCalledWith("/api/market/chatgpt/orders", expect.any(Object));
      expect(pushMock).toHaveBeenCalledWith("/market/chatgpt/orders/order%2F123");
    });

    expect(screen.queryByText("Checkout failed")).not.toBeInTheDocument();
  });
});
