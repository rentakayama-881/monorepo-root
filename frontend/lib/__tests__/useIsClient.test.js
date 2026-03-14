import React from "react";
import { renderHook } from "@testing-library/react";
import useIsClient from "../useIsClient";

describe("useIsClient", () => {
  it("should return true on client side", () => {
    const { result } = renderHook(() => useIsClient());
    expect(result.current).toBe(true);
  });

  it("should be a boolean", () => {
    const { result } = renderHook(() => useIsClient());
    expect(typeof result.current).toBe("boolean");
  });
});
