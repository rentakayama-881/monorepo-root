/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useFormState } from "../useFormState";

describe("useFormState", () => {
  const initial = { name: "", email: "", nested: { a: 1 } };

  it("returns initial values", () => {
    const { result } = renderHook(() => useFormState(initial));
    expect(result.current.values).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it("setField updates a single field", () => {
    const { result } = renderHook(() => useFormState(initial));
    act(() => result.current.setField("name", "Alice"));
    expect(result.current.values.name).toBe("Alice");
    expect(result.current.isDirty).toBe(true);
  });

  it("setFields updates multiple fields at once", () => {
    const { result } = renderHook(() => useFormState(initial));
    act(() => result.current.setFields({ name: "Bob", email: "bob@test.com" }));
    expect(result.current.values.name).toBe("Bob");
    expect(result.current.values.email).toBe("bob@test.com");
  });

  it("reset restores initial values", () => {
    const { result } = renderHook(() => useFormState(initial));
    act(() => result.current.setField("name", "Changed"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.values).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it("reset with new initial values", () => {
    const { result } = renderHook(() => useFormState(initial));
    const newInitial = { name: "New", email: "new@test.com", nested: { a: 2 } };
    act(() => result.current.reset(newInitial));
    expect(result.current.values).toEqual(newInitial);
    expect(result.current.isDirty).toBe(false);
  });
});
