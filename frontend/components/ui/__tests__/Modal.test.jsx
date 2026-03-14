import { render, screen } from "@testing-library/react";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "../Modal";

describe("Modal", () => {
  it("renders without crashing when open", () => {
    render(
      <Modal open onClose={jest.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <Modal open={false} onClose={jest.fn()} title="Hidden">
        <p>hidden content</p>
      </Modal>
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});

describe("ModalHeader", () => {
  it("renders without crashing", () => {
    render(<ModalHeader>Header</ModalHeader>);
    expect(screen.getByText("Header")).toBeInTheDocument();
  });
});

describe("ModalBody", () => {
  it("renders without crashing", () => {
    render(<ModalBody>Body content</ModalBody>);
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });
});

describe("ModalFooter", () => {
  it("renders without crashing", () => {
    render(<ModalFooter>Footer</ModalFooter>);
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});
