import { render, screen } from "@testing-library/react";
import Input from "../Input";

describe("Input", () => {
  it("renders without crashing", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<Input label="Email" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders with error", () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    render(<Input className="custom" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("custom");
  });
});
