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
  useAuthToken: jest.fn(() => "mock-token"),
  getBrowserBase: jest.fn(() => "https://browser.aivalid.id"),
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

// Mock @novnc/novnc — RFB requires a browser environment
jest.mock("@novnc/novnc/lib/rfb", () => {
  const MockRFB = jest.fn().mockImplementation(() => ({
    scaleViewport: false,
    resizeSession: false,
    showDotCursor: false,
    addEventListener: jest.fn(),
    disconnect: jest.fn(),
    sendCredentials: jest.fn(),
  }));
  return { __esModule: true, default: MockRFB };
});

// Mock WebRTCViewer dynamic import
jest.mock("next/dynamic", () => () => {
  const MockWebRTCViewer = (props) => <div data-testid="webrtc-viewer">WebRTC</div>;
  MockWebRTCViewer.displayName = "MockWebRTCViewer";
  return MockWebRTCViewer;
});

describe("SessionViewerClient", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    jest.useFakeTimers();

    usePricing.mockReturnValue({
      pricing: { pricePerHourIdr: 10000 },
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

  it("renders VNC container when session active with vnc_ws_url", () => {
    useSessionStatus.mockReturnValue({
      session: {
        session_id: "session-123",
        status: "active",
        stream_mode: "vnc",
        vnc_ws_url: "wss://browser.aivalid.id/ws/6300",
        started_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    render(<SessionViewerClient />);
    expect(screen.getByText("Hentikan Sesi")).toBeInTheDocument();
  });

  it("shows waiting state when vnc_ws_url is null", () => {
    useSessionStatus.mockReturnValue({
      session: {
        session_id: "session-123",
        status: "active",
        stream_mode: "vnc",
        vnc_ws_url: null,
        started_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    render(<SessionViewerClient />);
    expect(screen.getByText("Menunggu koneksi ke browser...")).toBeInTheDocument();
  });

  it("redirects when session stopped", () => {
    useSessionStatus.mockReturnValue({
      session: { session_id: "session-123", status: "stopped" },
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
