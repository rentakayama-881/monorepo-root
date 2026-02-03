/**
 * Unit tests for TagSelector component
 */

import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TagSelector from "../TagSelector";

function Wrapper({ availableTags, singlePerGroup }) {
  const [selectedTags, setSelectedTags] = useState([]);
  return (
    <TagSelector
      selectedTags={selectedTags}
      onTagsChange={setSelectedTags}
      availableTags={availableTags}
      maxTags={4}
      placeholder="Pilih tags..."
      enableSearch={false}
      singlePerGroup={singlePerGroup}
    />
  );
}

describe("TagSelector", () => {
  const tags = [
    { slug: "domain-frontend", name: "Frontend", description: "", icon: "layout" },
    { slug: "domain-backend", name: "Backend", description: "", icon: "server" },
    { slug: "artifact-patch", name: "Patch", description: "", icon: "diff" },
  ];

  it("allows multiple tags from same group when singlePerGroup=false", () => {
    render(<Wrapper availableTags={tags} singlePerGroup={false} />);

    fireEvent.click(screen.getByRole("button", { name: /pilih tags/i }));
    fireEvent.click(screen.getByRole("button", { name: "Frontend" }));

    fireEvent.click(screen.getByRole("button", { name: /pilih tags/i }));
    fireEvent.click(screen.getByRole("button", { name: "Backend" }));

    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("replaces tags within a group when singlePerGroup=true", () => {
    render(<Wrapper availableTags={tags} singlePerGroup={true} />);

    fireEvent.click(screen.getByRole("button", { name: /pilih tags/i }));
    fireEvent.click(screen.getByRole("button", { name: "Frontend" }));
    expect(screen.getByText("Frontend")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pilih tags/i }));
    fireEvent.click(screen.getByRole("button", { name: "Backend" }));

    expect(screen.queryByText("Frontend")).not.toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });
});

