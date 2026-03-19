import { render } from "@testing-library/react";
import OrderDetailLoading from "../loading";

describe("OrderDetailLoading", () => {
  it("renders without crashing", () => {
    const { container } = render(<OrderDetailLoading />);
    expect(container.querySelector("main")).toBeInTheDocument();
  });
});
