/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAsyncAction } from "../useAsyncAction";

describe("useAsyncAction", () => {
  it("starts idle (no loading, no error)", () => {
    const action = jest.fn();
    const { result } = renderHook(() => useAsyncAction(action));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("sets loading during execution", async () => {
    let resolve;
    const action = () =>
      new Promise((r) => {
        resolve = r;
      });
    const { result } = renderHook(() => useAsyncAction(action));

    let promise;
    act(() => {
      promise = result.current.execute();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolve("done");
      await promise;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe("done");
  });

  it("captures error on failure", async () => {
    const action = () => Promise.reject(new Error("fail!"));
    const onError = jest.fn();
    const { result } = renderHook(() => useAsyncAction(action, { onError }));

    await act(async () => {
      try {
        await result.current.execute();
      } catch {}
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("fail!");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("calls onSuccess with result", async () => {
    const action = () => Promise.resolve({ id: 1 });
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useAsyncAction(action, { onSuccess }));

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
    expect(result.current.data).toEqual({ id: 1 });
  });

  it("reset clears all state", async () => {
    const action = () => Promise.resolve("data");
    const { result } = renderHook(() => useAsyncAction(action));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe("data");

    act(() => result.current.reset());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("passes arguments to action function", async () => {
    const action = jest.fn().mockResolvedValue("ok");
    const { result } = renderHook(() => useAsyncAction(action));

    await act(async () => {
      await result.current.execute("arg1", 42);
    });
    expect(action).toHaveBeenCalledWith("arg1", 42);
  });
});
