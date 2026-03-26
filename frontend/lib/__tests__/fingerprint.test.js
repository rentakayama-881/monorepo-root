// Mock the logger
jest.mock("../logger", () => ({
  warn: jest.fn(),
}));

const mockGet = jest.fn(() => Promise.resolve({ visitorId: "mock-visitor-id-123" }));
const mockLoad = jest.fn(() => Promise.resolve({ get: mockGet }));

// Mock @fingerprintjs/fingerprintjs — dynamic import() returns ESM namespace
jest.mock("@fingerprintjs/fingerprintjs", () => ({
  __esModule: true,
  default: { load: mockLoad },
}));

// We must re-import for each test group because fpPromise is module-level cached
let getDeviceFingerprint;
let getDeviceFingerprintWithTimeout;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset module so fpPromise is null again
  jest.resetModules();

  // Re-apply mocks after resetModules
  jest.doMock("../logger", () => ({ warn: jest.fn() }));

  const freshMockGet = jest.fn(() => Promise.resolve({ visitorId: "mock-visitor-id-123" }));
  const freshMockLoad = jest.fn(() => Promise.resolve({ get: freshMockGet }));
  jest.doMock("@fingerprintjs/fingerprintjs", () => ({
    __esModule: true,
    default: { load: freshMockLoad },
  }));

  const mod = require("../fingerprint");
  getDeviceFingerprint = mod.getDeviceFingerprint;
  getDeviceFingerprintWithTimeout = mod.getDeviceFingerprintWithTimeout;
});

describe("fingerprint", () => {
  describe("getDeviceFingerprint", () => {
    it("returns a visitor ID string", async () => {
      const result = await getDeviceFingerprint();
      expect(result).toBe("mock-visitor-id-123");
    });

    it("calls fingerprintjs load and get", async () => {
      await getDeviceFingerprint();
      const fpjs = require("@fingerprintjs/fingerprintjs");
      expect(fpjs.default.load).toHaveBeenCalled();
    });
  });

  describe("getDeviceFingerprintWithTimeout", () => {
    it("returns fingerprint when it resolves before timeout", async () => {
      const result = await getDeviceFingerprintWithTimeout(5000);
      expect(result).toBe("mock-visitor-id-123");
    });

    it("returns empty string on timeout", async () => {
      // Reset again with slow mock
      jest.resetModules();
      jest.doMock("../logger", () => ({ warn: jest.fn() }));
      jest.doMock("@fingerprintjs/fingerprintjs", () => ({
        __esModule: true,
        default: {
          load: jest.fn(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      get: () => Promise.resolve({ visitorId: "slow" }),
                    }),
                  10000
                )
              )
          ),
        },
      }));

      const { getDeviceFingerprintWithTimeout: freshFn } = require("../fingerprint");
      const result = await freshFn(50); // very short timeout
      expect(result).toBe("");
    });
  });
});
