import { render, screen, act } from "@testing-library/react";
import SessionViewerClient from "../SessionViewerClient";
import { useSessionStatus, usePricing } from "../../../useCloudBrowser";

const replaceMock = jest.fn();
const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ id: "session-123" })),
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

jest.mock("../../../useCloudBrowser", () => ({
  useSessionStatus: jest.fn(),
  usePricing: jest.fn(),
}));

jest.mock("@/lib/browserApi", () => ({
  stopSession: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/lib/swr", () => ({
  useWallet: jest.fn(() => ({
    wallet: { balance: 100000 },
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  })),
}));

describe("SessionViewerClient", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    jest.useFakeTimers();

    usePricing.mockReturnValue({
      pricing: { price_per_hour: 10000 },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows loading state", () => {
    useSessionStatus.mockReturnValue({
      session: null,
      isLoading: true,
      error: null,
      mutate: jest.fn(),
    });

    render(<SessionViewerClient />);
    expect(screen.getByText("Memuat sesi browser...")).toBeInTheDocument();
  });

  it("renders iframe when session active", () => {
    useSessionStatus.mockReturnValue({
      session: {
        id: "session-123",
        status: "running",
        vnc_port: 5900,
        started_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    render(<SessionViewerClient />);
    const iframe = screen.getByTitle("Browser Session");
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe("IFRAME");
  });

  it("redirects when session stopped", () => {
    useSessionStatus.mockReturnValue({
      session: { id: "session-123", status: "stopped" },
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    render(<SessionViewerClient />);
    expect(screen.getByText(/Sesi telah berakhir/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(replaceMock).toHaveBeenCalledWith("/cloud-browser");
  });
});
