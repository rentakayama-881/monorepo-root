import { render, screen } from "@testing-library/react";
import NotFound, { metadata } from "../not-found";

jest.mock("@/components/ui/SearchInput", () => {
  return function MockSearchInput(props) {
    return <input data-testid="search-input" placeholder={props.placeholder} />;
  };
});

describe("NotFound", () => {
  it("renders 404 text and heading", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Halaman Tidak Ditemukan")).toBeInTheDocument();
  });

  it("exports metadata with noindex robots", () => {
    expect(metadata.title).toBe("Halaman Tidak Ditemukan");
    expect(metadata.robots.index).toBe(false);
  });
});
