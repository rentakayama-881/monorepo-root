import { render } from "@testing-library/react";

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
  getUser: jest.fn(() => ({ id: 1, username: "test", role: "user" })),
  isLoggedIn: jest.fn(() => true),
  logout: jest.fn(),
  clearToken: jest.fn(),
  AUTH_CHANGED_EVENT: "auth-changed",
}));

jest.mock("@/lib/adminAuth", () => ({
  getAdminToken: jest.fn(() => "mock-admin-token"),
  getAdminUser: jest.fn(() => ({ id: 1, username: "admin", role: "admin" })),
  isAdminLoggedIn: jest.fn(() => true),
  adminLogout: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  fetchJson: jest.fn(() => Promise.resolve({})),
  fetchJsonAuth: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/lib/featureApi", () => ({
  fetchFeature: jest.fn(() => Promise.resolve({})),
  fetchFeatureAuth: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/lib/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("swr", () =>
  jest.fn(() => ({
    data: null,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
  }))
);

jest.mock("@/lib/swr", () => ({
  swrConfig: {},
  authFetcher: jest.fn(),
  useWallet: jest.fn(() => ({
    wallet: null,
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  })),
}));

jest.mock("@/lib/browserApi", () => ({
  fetchBrowserApi: jest.fn(() => Promise.resolve({})),
  createProfile: jest.fn(() => Promise.resolve({})),
  updateProfile: jest.fn(() => Promise.resolve({})),
  deleteProfile: jest.fn(() => Promise.resolve({})),
  startSession: jest.fn(() => Promise.resolve({})),
  stopSession: jest.fn(() => Promise.resolve({})),
  getSessionStatus: jest.fn(() => Promise.resolve({})),
  getSessions: jest.fn(() => Promise.resolve({})),
  getProfiles: jest.fn(() => Promise.resolve({})),
  getPricing: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/components/ui/Portal", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

describe("CloudBrowser Page", () => {
  it("module loads without error", () => {
    const mod = require("../page");
    expect(mod).toBeDefined();
  });
});
