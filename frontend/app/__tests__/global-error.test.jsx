import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "../global-error";

jest.mock("@sentry/browser", () => ({
  captureException: jest.fn(),
}));

describe("GlobalError", () => {
  const mockError = new Error("Critical failure");
  const mockReset = jest.fn();

  it("renders critical error heading", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText("Terjadi Kesalahan Aplikasi Kritis")).toBeInTheDocument();
  });

  it("calls reset when Muat Ulang is clicked", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Muat Ulang"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
