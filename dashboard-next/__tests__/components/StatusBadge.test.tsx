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

  it("applies orange styling for pending status", () => {
    const { container } = render(<StatusBadge status="pending" />);
    expect(container.firstChild).toHaveClass("text-orange-300");
  });

  it("applies blue styling for acknowledged status", () => {
    const { container } = render(<StatusBadge status="acknowledged" />);
    expect(container.firstChild).toHaveClass("text-blue-300");
  });

  it("applies green styling for completed status", () => {
    const { container } = render(<StatusBadge status="completed" />);
    expect(container.firstChild).toHaveClass("text-green-300");
  });

  it("applies yellow styling for deferred status", () => {
    const { container } = render(<StatusBadge status="deferred" />);
    expect(container.firstChild).toHaveClass("text-yellow-300");
  });

  it("applies zinc styling for dismissed status", () => {
    const { container } = render(<StatusBadge status="dismissed" />);
    expect(container.firstChild).toHaveClass("text-zinc-400");
  });
});
