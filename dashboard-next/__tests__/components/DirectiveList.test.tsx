import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DirectiveList from "@/components/directives/DirectiveList";
import type { Directive } from "@/types";

const makeDirective = (overrides: Partial<Directive> = {}): Directive => ({
  id: "dir-1-abc123",
  text: "Test directive",
  type: "task",
  priority: "normal",
  status: "pending",
  created_at: "2026-02-25T16:00:00Z",
  acknowledged_at: null,
  completed_at: null,
  agent_notes: null,
  ...overrides,
});

describe("DirectiveList", () => {
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    mockOnDelete.mockClear();
  });

  it("renders empty state when no directives", () => {
    render(<DirectiveList directives={[]} onDelete={mockOnDelete} />);
    expect(screen.getByText(/no directives/i)).toBeInTheDocument();
  });

  it("renders a pending directive", () => {
    const d = makeDirective({ text: "Build a feature" });
    render(<DirectiveList directives={[d]} onDelete={mockOnDelete} />);
    expect(screen.getByText("Build a feature")).toBeInTheDocument();
  });

  it("groups pending directives under Pending section", () => {
    const d = makeDirective({ status: "pending" });
    render(<DirectiveList directives={[d]} onDelete={mockOnDelete} />);
    expect(screen.getByRole("heading", { name: /pending/i })).toBeInTheDocument();
  });

  it("groups completed directives under Completed section", () => {
    const d = makeDirective({ status: "completed" });
    render(<DirectiveList directives={[d]} onDelete={mockOnDelete} />);
    expect(screen.getByRole("heading", { name: /completed/i })).toBeInTheDocument();
  });

  it("shows delete button only for pending directives", () => {
    const pending = makeDirective({ id: "dir-1-aaa111", status: "pending" });
    const completed = makeDirective({
      id: "dir-2-bbb222",
      status: "completed",
      text: "Done directive",
    });
    render(
      <DirectiveList
        directives={[pending, completed]}
        onDelete={mockOnDelete}
      />
    );
    // One delete button for pending
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(deleteButtons).toHaveLength(1);
  });

  it("calls onDelete with directive id when delete clicked", () => {
    const d = makeDirective({ id: "dir-1-abc123", status: "pending" });
    render(<DirectiveList directives={[d]} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(mockOnDelete).toHaveBeenCalledWith("dir-1-abc123");
  });

  it("shows agent notes when present", () => {
    const d = makeDirective({
      status: "acknowledged",
      agent_notes: "Working on it now",
    });
    render(<DirectiveList directives={[d]} onDelete={mockOnDelete} />);
    expect(screen.getByText("Working on it now")).toBeInTheDocument();
  });

  it("shows type and priority for each directive", () => {
    const d = makeDirective({ type: "focus", priority: "urgent" });
    render(<DirectiveList directives={[d]} onDelete={mockOnDelete} />);
    expect(screen.getByText(/focus/i)).toBeInTheDocument();
    expect(screen.getByText(/urgent/i)).toBeInTheDocument();
  });

  it("renders multiple directives", () => {
    const directives = [
      makeDirective({ id: "dir-1-aaa111", text: "First directive" }),
      makeDirective({ id: "dir-2-bbb222", text: "Second directive" }),
    ];
    render(<DirectiveList directives={directives} onDelete={mockOnDelete} />);
    expect(screen.getByText("First directive")).toBeInTheDocument();
    expect(screen.getByText("Second directive")).toBeInTheDocument();
  });
});
