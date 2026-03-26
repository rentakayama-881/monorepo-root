import React from "react";
import { render, act } from "@testing-library/react";
import { useAccountBadges } from "../useAccountBadges";

jest.mock("@/lib/tokenRefresh", () => ({
  fetchWithAuth: jest.fn(),
}));

const { fetchWithAuth } = require("@/lib/tokenRefresh");

describe("useAccountBadges", () => {
  let result;
  const setError = jest.fn();
  const setOk = jest.fn();

  function TestComponent({ apiBase }) {
    Object.assign(result, useAccountBadges({ apiBase, setError, setOk }));
    return null;
  }

  beforeEach(() => {
    result = {};
    jest.clearAllMocks();
  });

  it("returns initial state", () => {
    render(<TestComponent apiBase="/api" />);

    expect(result.badges).toEqual([]);
    expect(result.primaryBadgeId).toBeNull();
    expect(result.savingBadge).toBe(false);
  });

  it("populate fills badges and primaryBadgeId", () => {
    render(<TestComponent apiBase="/api" />);

    act(() => {
      result.populate({
        badges: [{ id: 1, name: "Pro" }],
        primary_badge_id: 1,
      });
    });

    expect(result.badges).toEqual([{ id: 1, name: "Pro" }]);
    expect(result.primaryBadgeId).toBe(1);
  });

  it("savePrimaryBadge calls API and updates state on success", async () => {
    fetchWithAuth.mockResolvedValue({ ok: true });

    render(<TestComponent apiBase="/api" />);

    await act(async () => {
      await result.savePrimaryBadge(5);
    });

    expect(fetchWithAuth).toHaveBeenCalledWith("/api/account/primary-badge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: 5 }),
    });
    expect(result.primaryBadgeId).toBe(5);
    expect(setOk).toHaveBeenCalledWith("Display badge berhasil dipasang.");
  });

  it("savePrimaryBadge with null badgeId removes badge", async () => {
    fetchWithAuth.mockResolvedValue({ ok: true });

    render(<TestComponent apiBase="/api" />);

    await act(async () => {
      await result.savePrimaryBadge(null);
    });

    expect(result.primaryBadgeId).toBeNull();
    expect(setOk).toHaveBeenCalledWith("Display badge berhasil dilepas.");
  });

  it("savePrimaryBadge sets error on failure", async () => {
    fetchWithAuth.mockResolvedValue({ ok: false });

    render(<TestComponent apiBase="/api" />);

    await act(async () => {
      await result.savePrimaryBadge(3);
    });

    expect(setError).toHaveBeenCalledWith("Gagal menyimpan primary badge");
  });
});
