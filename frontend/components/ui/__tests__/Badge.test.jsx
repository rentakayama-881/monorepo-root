import { render, screen } from "@testing-library/react";
import Badge, { BadgeChip, BadgeList, VerifiedBadge, AdminBadge } from "../Badge";

describe("Badge", () => {
  it("renders without crashing", () => {
    render(<Badge badge={{ slug: "test", label: "Test", color: "blue" }} />);
  });

  it("accepts className prop", () => {
    const { container } = render(
      <Badge badge={{ slug: "test", label: "Test", color: "blue" }} className="custom" />
    );
    expect(container.firstChild).toHaveClass("custom");
  });
});

describe("BadgeChip", () => {
  it("renders without crashing", () => {
    render(<BadgeChip badge={{ slug: "test", label: "Test", color: "blue" }} />);
  });
});

describe("BadgeList", () => {
  it("renders without crashing", () => {
    render(<BadgeList badges={[{ slug: "a", label: "A", color: "blue" }]} />);
  });

  it("renders empty list", () => {
    const { container } = render(<BadgeList badges={[]} />);
    expect(container).toBeTruthy();
  });
});

describe("VerifiedBadge", () => {
  it("renders without crashing", () => {
    const { container } = render(<VerifiedBadge />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("AdminBadge", () => {
  it("renders without crashing", () => {
    const { container } = render(<AdminBadge />);
    expect(container.firstChild).toBeTruthy();
  });
});
