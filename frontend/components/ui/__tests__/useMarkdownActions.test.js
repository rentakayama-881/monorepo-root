import { renderHook, act } from "@testing-library/react";
import { useMarkdownActions } from "../useMarkdownActions";

describe("useMarkdownActions", () => {
  function createTextarea(value, selectionStart = 0, selectionEnd = 0) {
    return {
      current: {
        selectionStart,
        selectionEnd,
        focus: jest.fn(),
        setSelectionRange: jest.fn(),
      },
    };
  }

  it("returns all expected action functions", () => {
    const textareaRef = createTextarea("", 0, 0);
    const onChange = jest.fn();
    const { result } = renderHook(() => useMarkdownActions("", onChange, textareaRef));

    expect(typeof result.current.wrap).toBe("function");
    expect(typeof result.current.linePrefix).toBe("function");
    expect(typeof result.current.codeBlock).toBe("function");
    expect(typeof result.current.insertLink).toBe("function");
    expect(typeof result.current.insertTable).toBe("function");
  });

  describe("wrap", () => {
    it("inserts wrapper around default text when no selection", () => {
      const onChange = jest.fn();
      const textareaRef = createTextarea("hello", 5, 5);
      const { result } = renderHook(() => useMarkdownActions("hello", onChange, textareaRef));

      act(() => {
        result.current.wrap("**", "**", "bold");
      });

      expect(onChange).toHaveBeenCalledWith("hello**bold**");
    });

    it("wraps selected text", () => {
      const onChange = jest.fn();
      const textareaRef = createTextarea("hello world", 6, 11); // "world" selected
      const { result } = renderHook(() => useMarkdownActions("hello world", onChange, textareaRef));

      act(() => {
        result.current.wrap("**", "**", "bold");
      });

      expect(onChange).toHaveBeenCalledWith("hello **world**");
    });
  });

  describe("linePrefix", () => {
    it("adds prefix to the current line", () => {
      const onChange = jest.fn();
      const textareaRef = createTextarea("hello", 0, 0);
      const { result } = renderHook(() => useMarkdownActions("hello", onChange, textareaRef));

      act(() => {
        result.current.linePrefix("# ");
      });

      expect(onChange).toHaveBeenCalledWith("# hello");
    });
  });

  describe("codeBlock", () => {
    it("inserts code block with language", () => {
      const onChange = jest.fn();
      const textareaRef = createTextarea("", 0, 0);
      const { result } = renderHook(() => useMarkdownActions("", onChange, textareaRef));

      act(() => {
        result.current.codeBlock("js");
      });

      expect(onChange).toHaveBeenCalledWith("```js\ncode\n```");
    });
  });

  describe("insertLink", () => {
    it("inserts markdown link with default text", () => {
      const onChange = jest.fn();
      const textareaRef = createTextarea("", 0, 0);
      const { result } = renderHook(() => useMarkdownActions("", onChange, textareaRef));

      act(() => {
        result.current.insertLink(false);
      });

      expect(onChange).toHaveBeenCalledWith("[link text](url)");
    });

    it("inserts image link when isImage is true", () => {
      const onChange = jest.fn();
      const textareaRef = createTextarea("", 0, 0);
      const { result } = renderHook(() => useMarkdownActions("", onChange, textareaRef));

      act(() => {
        result.current.insertLink(true);
      });

      expect(onChange).toHaveBeenCalledWith("![alt text](url)");
    });
  });

  describe("insertTable", () => {
    it("inserts a markdown table", () => {
      const onChange = jest.fn();
      const textareaRef = createTextarea("", 0, 0);
      const { result } = renderHook(() => useMarkdownActions("", onChange, textareaRef));

      act(() => {
        result.current.insertTable();
      });

      const calledWith = onChange.mock.calls[0][0];
      expect(calledWith).toContain("| Header 1 |");
      expect(calledWith).toContain("| -------- |");
      expect(calledWith).toContain("| Cell 1   |");
    });
  });
});
