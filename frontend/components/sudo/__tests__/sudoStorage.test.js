import {
  safeStorageGet,
  safeStorageSet,
  safeStorageRemove,
  loadStoredSudoState,
  saveSudoToken,
  clearSudoStorage,
} from "../sudoStorage";

// localStorage is already mocked globally in jest.setup.js

describe("sudoStorage", () => {
  describe("safeStorageGet", () => {
    it("reads from localStorage", () => {
      localStorage.getItem.mockReturnValue("test-value");
      expect(safeStorageGet("key")).toBe("test-value");
      expect(localStorage.getItem).toHaveBeenCalledWith("key");
    });

    it("returns null if localStorage throws", () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error("access denied");
      });
      expect(safeStorageGet("key")).toBeNull();
    });
  });

  describe("safeStorageSet", () => {
    it("writes to localStorage", () => {
      safeStorageSet("key", "value");
      expect(localStorage.setItem).toHaveBeenCalledWith("key", "value");
    });

    it("silently ignores write failures", () => {
      localStorage.setItem.mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      expect(() => safeStorageSet("key", "value")).not.toThrow();
    });
  });

  describe("safeStorageRemove", () => {
    it("removes from localStorage", () => {
      safeStorageRemove("key");
      expect(localStorage.removeItem).toHaveBeenCalledWith("key");
    });
  });

  describe("loadStoredSudoState", () => {
    it("returns nulls when no token stored", () => {
      localStorage.getItem.mockReturnValue(null);
      expect(loadStoredSudoState()).toEqual({ token: null, expires: null });
    });

    it("returns token and expires when token is valid and not expired", () => {
      const futureDate = new Date(Date.now() + 60000).toISOString();
      localStorage.getItem.mockImplementation((key) => {
        if (key === "sudo_token") return "my-sudo-token";
        if (key === "sudo_expires") return futureDate;
        return null;
      });
      const result = loadStoredSudoState();
      expect(result.token).toBe("my-sudo-token");
      expect(result.expires).toBeInstanceOf(Date);
    });

    it("clears storage and returns nulls when token is expired", () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      localStorage.getItem.mockImplementation((key) => {
        if (key === "sudo_token") return "old-token";
        if (key === "sudo_expires") return pastDate;
        return null;
      });
      const result = loadStoredSudoState();
      expect(result).toEqual({ token: null, expires: null });
      expect(localStorage.removeItem).toHaveBeenCalledWith("sudo_token");
      expect(localStorage.removeItem).toHaveBeenCalledWith("sudo_expires");
    });
  });

  describe("saveSudoToken", () => {
    it("persists token and expiry to localStorage", () => {
      saveSudoToken("token123", "2025-12-31T00:00:00Z");
      expect(localStorage.setItem).toHaveBeenCalledWith("sudo_token", "token123");
      expect(localStorage.setItem).toHaveBeenCalledWith("sudo_expires", "2025-12-31T00:00:00Z");
    });
  });

  describe("clearSudoStorage", () => {
    it("removes both sudo keys from localStorage", () => {
      clearSudoStorage();
      expect(localStorage.removeItem).toHaveBeenCalledWith("sudo_token");
      expect(localStorage.removeItem).toHaveBeenCalledWith("sudo_expires");
    });
  });
});
