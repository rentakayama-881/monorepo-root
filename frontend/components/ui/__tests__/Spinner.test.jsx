import { render, screen } from "@testing-library/react";
import Spinner from "../Spinner";

describe("Spinner", () => {
  it("renders without crashing", () => {
    render(<Spinner />);
    expect(screen.getByLabelText("Memuat")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    render(<Spinner className="custom" />);
    expect(screen.getByLabelText("Memuat")).toHaveClass("custom");
  });
});
