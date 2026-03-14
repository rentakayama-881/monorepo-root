import { render, screen } from "@testing-library/react";
import FormLabel from "../FormLabel";

describe("FormLabel", () => {
  it("renders without crashing", () => {
    render(<FormLabel>Username</FormLabel>);
    expect(screen.getByText("Username")).toBeInTheDocument();
  });

  it("shows required indicator", () => {
    render(<FormLabel required>Email</FormLabel>);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows optional badge", () => {
    render(<FormLabel optional>Notes</FormLabel>);
    expect(screen.getByText("optional")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    render(
      <FormLabel className="custom" htmlFor="test">
        Label
      </FormLabel>
    );
    const label = screen.getByText("Label");
    expect(label).toHaveClass("custom");
  });
});
