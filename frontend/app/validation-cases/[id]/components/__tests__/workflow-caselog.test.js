import { renderHook, act } from "@testing-library/react";
import { useWorkflowCaseLog } from "../workflow-caselog";

describe("useWorkflowCaseLog", () => {
  it("returns initial state with empty arrays and no loading/error", () => {
    const { result } = renderHook(() => useWorkflowCaseLog());
    expect(result.current.caseLog).toEqual([]);
    expect(result.current.caseLogLoading).toBe(false);
    expect(result.current.caseLogError).toBe("");
  });

  it("allows setting case log data via exposed setters", () => {
    const { result } = renderHook(() => useWorkflowCaseLog());

    act(() => {
      result.current.setCaseLog([{ id: 1, event: "test" }]);
      result.current.setCaseLogLoading(true);
      result.current.setCaseLogError("Some error");
    });

    expect(result.current.caseLog).toEqual([{ id: 1, event: "test" }]);
    expect(result.current.caseLogLoading).toBe(true);
    expect(result.current.caseLogError).toBe("Some error");
  });
});
