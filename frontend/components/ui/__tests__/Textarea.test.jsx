import { render, screen } from "@testing-library/react";
import Textarea from "../Textarea";

describe("Textarea", () => {
  it("renders without crashing", () => {
    render(<Textarea />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<Textarea label="Description" />);
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("renders with error", () => {
    render(<Textarea label="Bio" error="Too short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    render(<Textarea className="custom" />);
    expect(screen.getByRole("textbox")).toHaveClass("custom");
  });
});
