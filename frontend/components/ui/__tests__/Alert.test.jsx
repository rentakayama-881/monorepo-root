import { render, screen } from "@testing-library/react";
import Alert from "../Alert";

describe("Alert", () => {
  it("renders without crashing", () => {
    render(<Alert message="Test alert" />);
    expect(screen.getByText("Test alert")).toBeInTheDocument();
  });

  it("renders with title", () => {
    render(<Alert title="Title" message="Body" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("renders all variants without crashing", () => {
    const { unmount: u1 } = render(<Alert variant="info" message="info" />);
    u1();
    const { unmount: u2 } = render(<Alert variant="success" message="success" />);
    u2();
    const { unmount: u3 } = render(<Alert variant="warning" message="warning" />);
    u3();
    render(<Alert variant="error" message="error" />);
  });

  it("accepts className prop", () => {
    const { container } = render(<Alert message="test" className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});
