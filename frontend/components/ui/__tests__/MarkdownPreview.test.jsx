import { render, screen } from "@testing-library/react";
import MarkdownPreview from "../MarkdownPreview";

jest.mock("react-markdown", () => {
  return function MockReactMarkdown({ children }) {
    return <div data-testid="markdown">{children}</div>;
  };
});

jest.mock("remark-gfm", () => () => {});
jest.mock("rehype-highlight", () => () => {});

describe("MarkdownPreview", () => {
  it("renders without crashing", () => {
    render(<MarkdownPreview content="Hello **world**" />);
  });

  it("renders empty content", () => {
    const { container } = render(<MarkdownPreview content="" />);
    expect(container).toBeTruthy();
  });

  it("accepts className prop", () => {
    const { container } = render(<MarkdownPreview content="test" className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});
