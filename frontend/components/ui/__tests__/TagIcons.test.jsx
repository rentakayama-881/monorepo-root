import { render } from "@testing-library/react";
import TagIcon from "../TagIcons";

describe("TagIcon", () => {
  it("renders without crashing with known icon", () => {
    const { container } = render(<TagIcon name="layout" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with unknown icon name", () => {
    const { container } = render(<TagIcon name="unknown-icon" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("accepts className prop", () => {
    const { container } = render(<TagIcon name="layout" className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});
