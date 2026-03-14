import { render, screen } from "@testing-library/react";
import NativeSelect from "../NativeSelect";

describe("NativeSelect", () => {
  it("renders without crashing", () => {
    render(<NativeSelect options={["A", "B"]} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders with object options", () => {
    const options = [
      { value: "1", label: "One" },
      { value: "2", label: "Two" },
    ];
    render(<NativeSelect options={options} />);
    expect(screen.getByText("One")).toBeInTheDocument();
  });

  it("renders children when no options", () => {
    render(
      <NativeSelect>
        <option value="x">Custom</option>
      </NativeSelect>
    );
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    render(<NativeSelect className="custom" options={["A"]} />);
    expect(screen.getByRole("combobox")).toHaveClass("custom");
  });
});
