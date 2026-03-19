import { render, screen } from "@testing-library/react";
import SearchInput from "../SearchInput";

describe("SearchInput", () => {
  it("renders without crashing", () => {
    render(<SearchInput />);
    expect(screen.getByPlaceholderText("Cari...")).toBeInTheDocument();
  });

  it("accepts custom placeholder", () => {
    render(<SearchInput placeholder="Find something..." />);
    expect(screen.getByPlaceholderText("Find something...")).toBeInTheDocument();
  });
});
