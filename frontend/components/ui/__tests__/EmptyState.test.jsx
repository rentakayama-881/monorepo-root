import { render, screen } from "@testing-library/react";
import EmptyState from "../EmptyState";

describe("EmptyState", () => {
  it("renders without crashing", () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders with description", () => {
    render(<EmptyState title="Empty" description="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders with icon", () => {
    render(<EmptyState title="Empty" icon="📭" />);
    expect(screen.getByText("📭")).toBeInTheDocument();
  });

  it("renders compact mode", () => {
    const { container } = render(<EmptyState title="Empty" compact />);
    expect(container.firstChild).toBeTruthy();
  });
});
