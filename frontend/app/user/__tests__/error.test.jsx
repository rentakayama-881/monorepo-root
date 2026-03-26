import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "../error";

jest.mock("@/lib/logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

describe("UserError", () => {
  const mockError = { message: "User page error", digest: "" };
  const mockReset = jest.fn();

  it("renders user error heading", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText("Failed to load the user page.")).toBeInTheDocument();
  });

  it("calls reset on retry click", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Coba Lagi"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
