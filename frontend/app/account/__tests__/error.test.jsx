import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "../error";

jest.mock("@/lib/logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

describe("AccountError", () => {
  const mockError = { message: "Test account error", digest: "" };
  const mockReset = jest.fn();

  it("renders the error heading and retry button", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText("Failed to load the account page.")).toBeInTheDocument();
    expect(screen.getByText("Coba Lagi")).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Coba Lagi"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
