import { render, screen } from "@testing-library/react";
import Card from "../Card";

// Card exports sub-components as properties
const CardHeader = Card.Header || (() => null);
const CardTitle = Card.Title || (() => null);
const CardDescription = Card.Description || (() => null);
const CardContent = Card.Content || (() => null);
const CardFooter = Card.Footer || (() => null);

describe("Card", () => {
  it("renders without crashing", () => {
    render(<Card>card content</Card>);
    expect(screen.getByText("card content")).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(<Card className="custom">test</Card>);
    expect(container.firstChild).toHaveClass("custom");
  });

  it("renders with variant", () => {
    const { container } = render(<Card variant="elevated">test</Card>);
    expect(container.firstChild).toBeTruthy();
  });
});
