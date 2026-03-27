import { render, screen, fireEvent } from "@testing-library/react";
import CloudBrowserClient from "../CloudBrowserClient";
import { useProfiles, useActiveSessions, usePricing } from "../useCloudBrowser";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: jest.fn(),
  }),
}));

jest.mock("../useCloudBrowser", () => ({
  useProfiles: jest.fn(),
  useActiveSessions: jest.fn(),
  usePricing: jest.fn(),
}));

jest.mock("@/lib/browserApi", () => ({
  createProfile: jest.fn(() => Promise.resolve({})),
  updateProfile: jest.fn(() => Promise.resolve({})),
  deleteProfile: jest.fn(() => Promise.resolve({})),
  startSession: jest.fn(() => Promise.resolve({ session: { id: "sess-1" } })),
}));

jest.mock("@/lib/swr", () => ({
  swrConfig: {},
  authFetcher: jest.fn(),
  useWallet: jest.fn(() => ({
    wallet: { balance: 100000 },
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  })),
}));

jest.mock("@/components/ui/Portal", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
  AUTH_CHANGED_EVENT: "auth-changed",
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("CloudBrowserClient", () => {
  beforeEach(() => {
    pushMock.mockReset();

    useProfiles.mockReturnValue({
      profiles: [],
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: jest.fn(),
    });

    useActiveSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    usePricing.mockReturnValue({
      pricing: { price_per_hour: 10000 },
      pricePerHour: 10000,
      pricePerMinute: 167,
      isLoading: false,
      error: null,
    });
  });

  it("renders empty state when no profiles", () => {
    render(<CloudBrowserClient />);
    expect(screen.getByText("Belum ada profil browser")).toBeInTheDocument();
  });

  it("renders profiles grid when profiles exist", () => {
    useProfiles.mockReturnValue({
      profiles: [
        { id: "p1", name: "Profile Alpha", proxy_server: "socks5://proxy:1080" },
        { id: "p2", name: "Profile Beta" },
      ],
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: jest.fn(),
    });

    render(<CloudBrowserClient />);
    expect(screen.getByText("Profile Alpha")).toBeInTheDocument();
    expect(screen.getByText("Profile Beta")).toBeInTheDocument();
  });

  it("create profile button exists", () => {
    render(<CloudBrowserClient />);
    expect(screen.getByText("Buat Profil")).toBeInTheDocument();
  });

  it("shows loading skeleton when profiles loading", () => {
    useProfiles.mockReturnValue({
      profiles: [],
      isLoading: true,
      error: null,
      mutate: jest.fn(),
    });

    const { container } = render(<CloudBrowserClient />);
    const skeletons = container.querySelectorAll("[aria-hidden='true']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
