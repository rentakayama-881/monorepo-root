import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearToken,
  getRefreshToken,
  getToken,
  setTokens,
} from "../auth";

const storage = {};

function resetStorage() {
  Object.keys(storage).forEach((key) => delete storage[key]);
}

beforeEach(() => {
  resetStorage();
  vi.restoreAllMocks();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key) => (key in storage ? storage[key] : null),
      setItem: (key, value) => {
        storage[key] = String(value);
      },
      removeItem: (key) => {
        delete storage[key];
      },
    },
    configurable: true,
  });
});

describe("auth token storage", () => {
  it("stores access token and refresh token when provided", () => {
    setTokens("access-1", "refresh-1", 10);
    expect(getToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("does not overwrite refresh token when undefined", () => {
    setTokens("access-1", "refresh-1", 10);
    setTokens("access-2", undefined, 10);
    expect(getToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("clears tokens", () => {
    setTokens("access-1", "refresh-1", 10);
    clearToken();
    expect(getToken()).toBe(null);
    expect(getRefreshToken()).toBe(null);
  });
});
