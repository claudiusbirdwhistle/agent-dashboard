import React from "react";
import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/directives/StatusBadge";
import type { DirectiveStatus } from "@/types";

describe("StatusBadge", () => {
  const statuses: DirectiveStatus[] = [
    "pending",
    "acknowledged",
    "completed",
    "deferred",
    "dismissed",
  ];

  it("renders the status text", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it.each(statuses)("renders %s status without crashing", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies orange color for pending status", () => {
    const { container } = render(<StatusBadge status="pending" />);
    expect(container.firstChild).toHaveClass("pending");
  });

  it("applies blue color for acknowledged status", () => {
    const { container } = render(<StatusBadge status="acknowledged" />);
    expect(container.firstChild).toHaveClass("acknowledged");
  });

  it("applies green color for completed status", () => {
    const { container } = render(<StatusBadge status="completed" />);
    expect(container.firstChild).toHaveClass("completed");
  });

  it("applies gray color for deferred status", () => {
    const { container } = render(<StatusBadge status="deferred" />);
    expect(container.firstChild).toHaveClass("deferred");
  });

  it("applies red color for dismissed status", () => {
    const { container } = render(<StatusBadge status="dismissed" />);
    expect(container.firstChild).toHaveClass("dismissed");
  });
});
