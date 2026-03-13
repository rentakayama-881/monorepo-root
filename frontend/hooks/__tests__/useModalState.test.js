/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useModalState } from "../useModalState";

describe("useModalState", () => {
  it("all modals closed initially", () => {
    const { result } = renderHook(() => useModalState());
    expect(result.current.isOpen("delete")).toBe(false);
    expect(result.current.isOpen("edit")).toBe(false);
    expect(result.current.getData("delete")).toBeNull();
  });

  it("open sets modal to open", () => {
    const { result } = renderHook(() => useModalState());
    act(() => result.current.open("delete"));
    expect(result.current.isOpen("delete")).toBe(true);
    expect(result.current.isOpen("edit")).toBe(false);
  });

  it("open with data stores associated data", () => {
    const { result } = renderHook(() => useModalState());
    act(() => result.current.open("edit", { id: 123, name: "test" }));
    expect(result.current.isOpen("edit")).toBe(true);
    expect(result.current.getData("edit")).toEqual({ id: 123, name: "test" });
  });

  it("close sets modal to closed and clears data", () => {
    const { result } = renderHook(() => useModalState());
    act(() => result.current.open("edit", { id: 1 }));
    act(() => result.current.close("edit"));
    expect(result.current.isOpen("edit")).toBe(false);
    expect(result.current.getData("edit")).toBeNull();
  });

  it("toggle flips modal state", () => {
    const { result } = renderHook(() => useModalState());
    act(() => result.current.toggle("delete"));
    expect(result.current.isOpen("delete")).toBe(true);
    act(() => result.current.toggle("delete"));
    expect(result.current.isOpen("delete")).toBe(false);
  });

  it("closeAll closes all modals", () => {
    const { result } = renderHook(() => useModalState());
    act(() => {
      result.current.open("delete");
      result.current.open("edit", { id: 1 });
    });
    act(() => result.current.closeAll());
    expect(result.current.isOpen("delete")).toBe(false);
    expect(result.current.isOpen("edit")).toBe(false);
  });

  it("multiple modals can be open simultaneously", () => {
    const { result } = renderHook(() => useModalState());
    act(() => {
      result.current.open("delete");
      result.current.open("confirm");
    });
    expect(result.current.isOpen("delete")).toBe(true);
    expect(result.current.isOpen("confirm")).toBe(true);
  });
});
