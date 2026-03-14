import { render, screen } from "@testing-library/react";
import { CenteredSpinner, SectionLoadingBlock, PageLoadingBlock } from "../LoadingState";

describe("CenteredSpinner", () => {
  it("renders without crashing", () => {
    render(<CenteredSpinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    render(<CenteredSpinner className="custom" />);
    expect(screen.getByRole("status")).toHaveClass("custom");
  });
});

describe("SectionLoadingBlock", () => {
  it("renders without crashing", () => {
    const { container } = render(<SectionLoadingBlock />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("PageLoadingBlock", () => {
  it("renders without crashing", () => {
    const { container } = render(<PageLoadingBlock />);
    expect(container.firstChild).toBeTruthy();
  });
});
