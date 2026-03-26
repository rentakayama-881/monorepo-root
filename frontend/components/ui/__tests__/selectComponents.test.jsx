import { render, screen } from "@testing-library/react";

jest.mock("@/lib/utils", () => ({
  cn: (...args) => args.filter(Boolean).join(" "),
}));

import { NativeSelect, SelectDropdownMenu } from "../selectComponents";

describe("NativeSelect", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <NativeSelect selectId="test-select" label="Test Label" value="" onChange={jest.fn()}>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </NativeSelect>
    );
    expect(container).toBeTruthy();
  });

  it("renders label", () => {
    render(
      <NativeSelect selectId="test-select" label="Test Label" value="" onChange={jest.fn()}>
        <option value="a">Option A</option>
      </NativeSelect>
    );
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("renders with error state", () => {
    render(
      <NativeSelect
        selectId="test-select"
        label="Test Label"
        value=""
        onChange={jest.fn()}
        error="Required field"
      >
        <option value="a">Option A</option>
      </NativeSelect>
    );
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });

  it("renders with hint", () => {
    render(
      <NativeSelect
        selectId="test-select"
        label="Test Label"
        value=""
        onChange={jest.fn()}
        hint="Helper text"
        hintId="test-hint"
      >
        <option value="a">Option A</option>
      </NativeSelect>
    );
    expect(screen.getByText("Helper text")).toBeInTheDocument();
  });
});

describe("SelectDropdownMenu", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <SelectDropdownMenu
        filteredOpts={[{ value: "a", label: "Option A" }]}
        groupedOpts={{ default: [{ value: "a", label: "Option A" }] }}
        multiSelect={false}
        selectedValues={[]}
        onSelect={jest.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders option items", () => {
    render(
      <SelectDropdownMenu
        filteredOpts={[{ value: "a", label: "Option A" }]}
        groupedOpts={{ default: [{ value: "a", label: "Option A" }] }}
        multiSelect={false}
        selectedValues={[]}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText("Option A")).toBeInTheDocument();
  });

  it("renders empty message when no options", () => {
    render(
      <SelectDropdownMenu
        filteredOpts={[]}
        groupedOpts={{}}
        multiSelect={false}
        selectedValues={[]}
        onSelect={jest.fn()}
        emptyMessage="No options"
      />
    );
    expect(screen.getByText("No options")).toBeInTheDocument();
  });
});
