import { render } from "@testing-library/react";
import AccountLoading from "../loading";

describe("AccountLoading", () => {
  it("renders without crashing", () => {
    const { container } = render(<AccountLoading />);
    expect(container.querySelector("main")).toBeInTheDocument();
  });
});
