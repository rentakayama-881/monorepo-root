import React from "react";
import { render, screen } from "@testing-library/react";
import { UserProvider, useUserContext, useAuth } from "../UserContext";

// Mock all dependencies
jest.mock("../swr", () => ({
  useUser: jest.fn(() => ({
    user: { username: "testuser", email: "test@test.com" },
    isLoading: false,
    error: null,
    mutate: jest.fn(),
    isLoggedIn: true,
  })),
  useWallet: jest.fn(() => ({
    wallet: { balance: 50000, pin_set: true },
    isLoading: false,
    mutate: jest.fn(),
  })),
  invalidateUserData: jest.fn(),
}));

jest.mock("../auth", () => ({
  getToken: jest.fn(() => "test-token"),
  getTokenExpiry: jest.fn(() => new Date(Date.now() + 300000)),
  clearToken: jest.fn(),
  setTokens: jest.fn(),
  AUTH_CHANGED_EVENT: "auth-changed",
}));

jest.mock("../api", () => ({
  getApiBase: () => "https://api.example.com",
}));

jest.mock("../tokenRefresh", () => ({
  refreshAccessToken: jest.fn(),
}));

function TestConsumer() {
  const ctx = useUserContext();
  return (
    <div>
      <span data-testid="username">{ctx.username}</span>
      <span data-testid="logged-in">{String(ctx.isLoggedIn)}</span>
      <span data-testid="balance">{ctx.walletBalance}</span>
      <span data-testid="has-pin">{String(ctx.hasPinSet)}</span>
    </div>
  );
}

function AuthConsumer() {
  const { isLoggedIn, isLoading, user } = useAuth();
  return (
    <div>
      <span data-testid="auth-logged-in">{String(isLoggedIn)}</span>
      <span data-testid="auth-loading">{String(isLoading)}</span>
      <span data-testid="auth-user">{user?.username || "none"}</span>
    </div>
  );
}

describe("UserContext.js", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  describe("UserProvider", () => {
    it("should provide user data to children", () => {
      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );
      expect(screen.getByTestId("username").textContent).toBe("testuser");
      expect(screen.getByTestId("logged-in").textContent).toBe("true");
    });

    it("should provide wallet data", () => {
      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );
      expect(screen.getByTestId("balance").textContent).toBe("50000");
      expect(screen.getByTestId("has-pin").textContent).toBe("true");
    });
  });

  describe("useAuth", () => {
    it("should return auth state", () => {
      render(
        <UserProvider>
          <AuthConsumer />
        </UserProvider>
      );
      expect(screen.getByTestId("auth-logged-in").textContent).toBe("true");
      expect(screen.getByTestId("auth-loading").textContent).toBe("false");
      expect(screen.getByTestId("auth-user").textContent).toBe("testuser");
    });
  });

  describe("useUserContext", () => {
    it("should throw when used outside UserProvider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<TestConsumer />)).toThrow(
        "useUserContext must be used within a UserProvider"
      );
      spy.mockRestore();
    });
  });
});
