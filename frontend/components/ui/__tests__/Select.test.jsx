import { render, screen } from "@testing-library/react";
import Select from "../Select";

describe("Select", () => {
  it("renders without crashing", () => {
    render(<Select options={[{ value: "a", label: "Option A" }]} />);
  });

  it("renders with label", () => {
    render(<Select label="Pick one" options={[]} />);
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(<Select placeholder="Choose..." options={[]} />);
    expect(screen.getByText("Choose...")).toBeInTheDocument();
  });

  it("renders with error", () => {
    render(<Select error="Required" options={[]} />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(<Select className="custom" options={[]} />);
    expect(container.firstChild).toBeTruthy();
  });
});
