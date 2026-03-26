import React from "react";
import { render, screen } from "@testing-library/react";
import { ToolbarBtn, Sep, I, MarkdownEditorPreview } from "../markdownEditorUtils";

describe("markdownEditorUtils", () => {
  describe("ToolbarBtn", () => {
    it("renders a button with title and children", () => {
      render(
        <ToolbarBtn title="Bold" onClick={jest.fn()}>
          B
        </ToolbarBtn>
      );
      const btn = screen.getByTitle("Bold");
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe("BUTTON");
      expect(btn).toHaveTextContent("B");
    });

    it("applies active class when active is true", () => {
      const { container } = render(
        <ToolbarBtn title="Active" onClick={jest.fn()} active={true}>
          A
        </ToolbarBtn>
      );
      const btn = container.querySelector("button");
      expect(btn.className).toContain("bg-primary");
    });

    it("sets disabled attribute when disabled is true", () => {
      render(
        <ToolbarBtn title="Disabled" onClick={jest.fn()} disabled={true}>
          D
        </ToolbarBtn>
      );
      expect(screen.getByTitle("Disabled")).toBeDisabled();
    });
  });

  describe("Sep", () => {
    it("renders a separator div", () => {
      const { container } = render(<Sep />);
      const sep = container.firstChild;
      expect(sep.tagName).toBe("DIV");
      expect(sep.className).toContain("bg-border");
    });
  });

  describe("I (icons)", () => {
    it("exports known icon keys as JSX elements", () => {
      const expectedKeys = [
        "h1",
        "h2",
        "h3",
        "bold",
        "italic",
        "strike",
        "quote",
        "code",
        "link",
        "ul",
        "ol",
        "task",
        "img",
        "table",
        "mention",
      ];
      for (const key of expectedKeys) {
        expect(I[key]).toBeDefined();
      }
    });
  });

  describe("MarkdownEditorPreview", () => {
    it("shows placeholder when value is empty", () => {
      render(<MarkdownEditorPreview value="" minHeight={100} />);
      expect(screen.getByText("Tidak ada konten untuk di-preview")).toBeInTheDocument();
    });

    it("renders content as pre when no PreviewComponent", () => {
      render(<MarkdownEditorPreview value="hello **world**" minHeight={100} />);
      expect(screen.getByText("hello **world**")).toBeInTheDocument();
    });

    it("uses PreviewComponent when provided", () => {
      const Preview = ({ content }) => <div data-testid="custom">{content}</div>;
      render(
        <MarkdownEditorPreview value="test content" minHeight={100} PreviewComponent={Preview} />
      );
      expect(screen.getByTestId("custom")).toHaveTextContent("test content");
    });
  });
});
