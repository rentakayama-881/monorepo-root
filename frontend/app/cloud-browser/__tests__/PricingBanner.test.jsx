import { render, screen } from "@testing-library/react";
import PricingBanner from "../PricingBanner";

jest.mock("@/lib/swr", () => ({
  useWallet: jest.fn(() => ({
    wallet: { balance: 250000 },
    isLoading: false,
    error: null,
    mutate: jest.fn(),
  })),
}));

describe("PricingBanner", () => {
  it("renders pricing info", () => {
    render(<PricingBanner pricing={{ price_per_hour: 10000 }} />);

    expect(screen.getByText("Saldo:")).toBeInTheDocument();
    expect(screen.getByText("Harga:")).toBeInTheDocument();
    expect(screen.getByText(/Billing per menit/)).toBeInTheDocument();
  });

  it("formats currency correctly", () => {
    render(<PricingBanner pricing={{ price_per_hour: 15000 }} />);

    // Balance: Rp 250.000 (from mocked wallet)
    expect(screen.getByText(/250/)).toBeInTheDocument();
    // Price: contains 15.000/jam or 15,000/jam depending on locale
    expect(screen.getByText(/15.*000.*\/jam/)).toBeInTheDocument();
  });
});
