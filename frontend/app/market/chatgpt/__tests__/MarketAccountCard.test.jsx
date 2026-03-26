import { render, screen } from "@testing-library/react";

jest.mock("@/lib/utils", () => ({
  cn: (...args) => args.filter(Boolean).join(" "),
}));

jest.mock("../marketChatGPTUtils", () => ({
  formatUnixDate: jest.fn(() => "01 Jan 2024"),
  boolText: jest.fn((v) => (v ? "Ya" : "Tidak")),
}));

jest.mock("lucide-react", () => ({
  X: (props) => <span data-testid="x-icon" {...props} />,
}));

import {
  ChatGPTIcon,
  MarketAccountCard,
  MarketAccountCardSkeleton,
  SpecDrawer,
} from "../MarketAccountCard";

const mockItem = {
  id: 1,
  title: "test@example.com",
  displayPriceIDR: "Rp 100.000",
  subscription: "Plus",
  country: "US",
  tier: null,
  seller: "seller1",
  uploadedAtLabel: "01 Jan 2024",
  canBuy: true,
  idValid: true,
  raw: {},
};

describe("ChatGPTIcon", () => {
  it("renders without crashing", () => {
    const { container } = render(<ChatGPTIcon className="w-5 h-5" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});

describe("MarketAccountCard", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <MarketAccountCard
        item={mockItem}
        checkingOut={false}
        onDetail={jest.fn()}
        onBuy={jest.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("displays item content", () => {
    const { container } = render(
      <MarketAccountCard
        item={mockItem}
        checkingOut={false}
        onDetail={jest.fn()}
        onBuy={jest.fn()}
      />
    );
    expect(container.textContent).toContain("test@example.com");
  });
});

describe("MarketAccountCardSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<MarketAccountCardSkeleton />);
    expect(container).toBeTruthy();
  });
});

describe("SpecDrawer", () => {
  it("renders without crashing when item is provided", () => {
    const { container } = render(<SpecDrawer item={mockItem} onClose={jest.fn()} />);
    expect(container).toBeTruthy();
  });

  it("returns null when item is null", () => {
    const { container } = render(<SpecDrawer item={null} onClose={jest.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});
