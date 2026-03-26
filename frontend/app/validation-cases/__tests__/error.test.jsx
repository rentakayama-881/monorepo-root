import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "../error";

jest.mock("@/lib/logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

describe("ValidationCasesError", () => {
  const mockReset = jest.fn();

  it("renders default error heading", () => {
    const mockError = { message: "generic error", digest: "" };
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText("Gagal memuat daftar kasus validasi.")).toBeInTheDocument();
  });

  it("detects rate limit error and shows specific heading", () => {
    const mockError = { message: "429 rate limit exceeded", digest: "" };
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText("Server sedang sibuk.")).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", () => {
    const mockError = { message: "generic error", digest: "" };
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Coba Lagi Sekarang"));
    expect(mockReset).toHaveBeenCalled();
  });
});
