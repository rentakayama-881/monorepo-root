import { registerAction } from "../actions";

// Mock fetch
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn();
});
afterAll(() => {
  global.fetch = originalFetch;
});
afterEach(() => jest.resetAllMocks());

function makeFormData(fields) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

describe("registerAction", () => {
  it("returns error when email is missing", async () => {
    const result = await registerAction(makeFormData({ password: "x", username: "u" }));
    expect(result.success).toBe(false);
    expect(result.error).toContain("wajib diisi");
  });

  it("returns error when password is missing", async () => {
    const result = await registerAction(makeFormData({ email: "a@b.c", username: "u" }));
    expect(result.success).toBe(false);
  });

  it("returns error when username is missing", async () => {
    const result = await registerAction(makeFormData({ email: "a@b.c", password: "x" }));
    expect(result.success).toBe(false);
  });

  it("calls API and returns success on 2xx", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: "abc", user: { id: 1 } }),
    });
    const result = await registerAction(
      makeFormData({ email: "a@b.c", password: "pass123", username: "testuser" })
    );
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns error on API failure", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Email sudah terdaftar" }),
    });
    const result = await registerAction(
      makeFormData({ email: "a@b.c", password: "pass123", username: "testuser" })
    );
    expect(result.success).toBe(false);
  });
});
