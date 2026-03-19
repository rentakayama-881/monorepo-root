import { render } from "@testing-library/react";
import UserProfileLoading from "../loading";

jest.mock(
  "../UserProfileSkeleton",
  () =>
    function MockSkeleton() {
      return <div data-testid="user-profile-skeleton" />;
    }
);

describe("UserProfileLoading", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(<UserProfileLoading />);
    expect(getByTestId("user-profile-skeleton")).toBeInTheDocument();
  });
});
