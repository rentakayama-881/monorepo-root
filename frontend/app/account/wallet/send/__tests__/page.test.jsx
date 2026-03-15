import { render } from "@testing-library/react";

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "mock-token"),
  getUser: jest.fn(() => ({ id: 1, username: "test", role: "user" })),
  isLoggedIn: jest.fn(() => true),
  logout: jest.fn(),
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
    mutate: jest.fn(),
  }))
);

describe("AccountWalletSend Page", () => {
  it("module loads without error", () => {
    const mod = require("../page");
    expect(mod).toBeDefined();
  });
});
