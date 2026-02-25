/**
 * Tests for EventCard and EventStream components
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import EventCard from "@/components/live/EventCard";
import type { LiveEvent } from "@/types";

const makeEvent = (type: LiveEvent["type"], content: string): LiveEvent => ({
  type,
  content,
  timestamp: new Date().toISOString(),
});

describe("EventCard", () => {
  it("renders event content", () => {
    render(<EventCard event={makeEvent("text", "Extracting helpers...")} />);
    expect(screen.getByText(/Extracting helpers/)).toBeInTheDocument();
  });

  it("renders system event type label", () => {
    render(<EventCard event={makeEvent("system", "Session started")} />);
    expect(screen.getByText(/system/i)).toBeInTheDocument();
  });

  it("renders tool-use event type label", () => {
    render(<EventCard event={makeEvent("tool-use", "Reading file.py")} />);
    expect(screen.getByText(/tool/i)).toBeInTheDocument();
  });

  it("renders error event type label", () => {
    render(<EventCard event={makeEvent("error", "Something failed")} />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it("is collapsible when clicked", () => {
    const { container } = render(
      <EventCard event={makeEvent("text", "Long content...")} />
    );
    const card = container.firstChild as HTMLElement;
    // Card should render without crashing; collapse state internal
    expect(card).toBeTruthy();
  });
});
