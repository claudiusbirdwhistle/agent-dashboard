/**
 * Tests for EventCard component
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import EventCard from "@/components/live/EventCard";
import type { LiveEvent } from "@/types";

const systemEvent: LiveEvent = {
  type: "system",
  subtype: "init",
  model: "claude-opus-4-6",
  session_id: "abc123def456",
  tools: ["Read", "Write", "Bash"],
  cwd: "/agent",
};

const assistantTextEvent: LiveEvent = {
  type: "assistant",
  message: {
    content: [{ type: "text", text: "Extracting helpers from the codebase..." }],
  },
};

const assistantToolEvent: LiveEvent = {
  type: "assistant",
  message: {
    content: [{ type: "tool_use", name: "Read", input: { file_path: "/agent/CLAUDE.md" } }],
  },
};

const resultEvent: LiveEvent = {
  type: "result",
  subtype: "success",
  num_turns: 12,
  cost_usd: 0.0345,
  duration_ms: 48200,
  result: "Task completed successfully.",
};

describe("EventCard", () => {
  it("renders system event tag", () => {
    render(<EventCard event={systemEvent} />);
    expect(screen.getByText(/system/i)).toBeInTheDocument();
  });

  it("renders assistant text event tag", () => {
    render(<EventCard event={assistantTextEvent} />);
    expect(screen.getByText(/text/i)).toBeInTheDocument();
  });

  it("shows text summary in header", () => {
    render(<EventCard event={assistantTextEvent} />);
    expect(screen.getByText(/Extracting helpers/)).toBeInTheDocument();
  });

  it("renders tool call event tag", () => {
    render(<EventCard event={assistantToolEvent} />);
    expect(screen.getByText(/tool call/i)).toBeInTheDocument();
  });

  it("shows tool name in summary", () => {
    render(<EventCard event={assistantToolEvent} />);
    expect(screen.getByText(/Read/)).toBeInTheDocument();
  });

  it("renders result event tag", () => {
    render(<EventCard event={resultEvent} />);
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });

  it("starts collapsed — body not visible", () => {
    const { container } = render(<EventCard event={assistantTextEvent} />);
    const pre = container.querySelector("pre");
    expect(pre).toBeNull();
  });

  it("expands on click to show body", () => {
    const { container } = render(<EventCard event={assistantTextEvent} />);
    const card = container.firstChild as HTMLElement;
    fireEvent.click(card);
    expect(container.querySelector("pre")).not.toBeNull();
  });

  it("collapses again on second click", () => {
    const { container } = render(<EventCard event={assistantTextEvent} />);
    const card = container.firstChild as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(card);
    expect(container.querySelector("pre")).toBeNull();
  });
});
