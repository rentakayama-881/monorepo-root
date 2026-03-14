import { render, screen } from "@testing-library/react";
import TagPill, { TagList } from "../TagPill";

jest.mock("../TagIcons", () => ({
  TagIcon: () => <span data-testid="tag-icon" />,
  __esModule: true,
  default: () => <span data-testid="tag-icon" />,
}));

const mockTag = { slug: "frontend", name: "Frontend", icon: "layout", color: "#3b82f6" };

describe("TagPill", () => {
  it("renders without crashing", () => {
    render(<TagPill tag={mockTag} />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(<TagPill tag={mockTag} className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});

describe("TagList", () => {
  it("renders without crashing", () => {
    render(<TagList tags={[mockTag]} />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("renders empty list", () => {
    const { container } = render(<TagList tags={[]} />);
    expect(container).toBeTruthy();
  });
});
