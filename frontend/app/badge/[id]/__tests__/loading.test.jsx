import { render } from "@testing-library/react";
import BadgeDetailLoading from "../loading";

describe("BadgeDetailLoading", () => {
  it("renders without crashing", () => {
    const { container } = render(<BadgeDetailLoading />);
    expect(container.querySelector("[aria-busy]")).toBeInTheDocument();
  });
});
