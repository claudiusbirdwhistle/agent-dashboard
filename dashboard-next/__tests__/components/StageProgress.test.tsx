/**
 * Tests for StageProgress component with detail inspection feature.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StageProgress from "@/components/tools/edgar-sentinel/StageProgress";
import type { StageResult } from "@/components/tools/edgar-sentinel/types";

const stagesAllPending: StageResult[] = [
  { stage: "ingestion", status: "pending" },
  { stage: "analysis", status: "pending" },
  { stage: "signals", status: "pending" },
  { stage: "backtest", status: "pending" },
];

const stagesWithSummaries: StageResult[] = [
  {
    stage: "ingestion",
    status: "completed",
    summary: "Ingested 5 filings (2 new, 3 cached) for 3 tickers",
    detail: {
      new_fetched: 2,
      from_cache: 3,
      total_in_db: 10,
      failures: 0,
      tickers: ["AAPL", "MSFT", "GOOGL"],
    },
  },
  {
    stage: "analysis",
    status: "completed",
    summary: "Generated 8 analysis results",
    detail: {
      new_sentiment: 4,
      cached_sentiment: 2,
      new_similarity: 1,
      cached_similarity: 1,
    },
  },
  {
    stage: "signals",
    status: "running",
    summary: undefined,
    detail: undefined,
  },
  { stage: "backtest", status: "pending" },
];

const stagesWithError: StageResult[] = [
  {
    stage: "ingestion",
    status: "failed",
    error: "EDGAR API rate limit exceeded",
  },
];

describe("StageProgress", () => {
  it("renders nothing when stages array is empty", () => {
    const { container } = render(<StageProgress stages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all stage labels", () => {
    render(<StageProgress stages={stagesAllPending} />);
    expect(screen.getByText("Ingestion")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Signal Generation")).toBeInTheDocument();
    expect(screen.getByText("Backtest")).toBeInTheDocument();
  });

  it("shows status badges for each stage", () => {
    render(<StageProgress stages={stagesAllPending} />);
    const badges = screen.getAllByText("pending");
    expect(badges.length).toBe(4);
  });

  it("shows stage summary when provided", () => {
    render(<StageProgress stages={stagesWithSummaries} />);
    expect(
      screen.getByText(
        "Ingested 5 filings (2 new, 3 cached) for 3 tickers"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Generated 8 analysis results")
    ).toBeInTheDocument();
  });

  it("shows error text when stage failed", () => {
    render(<StageProgress stages={stagesWithError} />);
    expect(
      screen.getByText("EDGAR API rate limit exceeded")
    ).toBeInTheDocument();
  });

  it("shows Inspect button for completed stages with detail data", () => {
    render(<StageProgress stages={stagesWithSummaries} />);
    const inspectButtons = screen.getAllByRole("button", { name: /inspect/i });
    // Two completed stages have detail data
    expect(inspectButtons.length).toBe(2);
  });

  it("does not show Inspect button for stages without detail data", () => {
    render(<StageProgress stages={stagesAllPending} />);
    expect(
      screen.queryByRole("button", { name: /inspect/i })
    ).not.toBeInTheDocument();
  });

  it("toggles detail panel open and closed when Inspect is clicked", () => {
    render(<StageProgress stages={stagesWithSummaries} />);
    const [firstInspect] = screen.getAllByRole("button", { name: /inspect/i });

    // Detail panel not visible initially
    expect(screen.queryByText("new_fetched")).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(firstInspect);
    expect(screen.getByText("new_fetched")).toBeInTheDocument();

    // Click again to close
    fireEvent.click(firstInspect);
    expect(screen.queryByText("new_fetched")).not.toBeInTheDocument();
  });

  it("shows detail key-value pairs in the inspect panel", () => {
    render(<StageProgress stages={stagesWithSummaries} />);
    const [firstInspect] = screen.getAllByRole("button", { name: /inspect/i });
    fireEvent.click(firstInspect);

    expect(screen.getByText("new_fetched")).toBeInTheDocument();
    expect(screen.getByText("from_cache")).toBeInTheDocument();
    expect(screen.getByText("total_in_db")).toBeInTheDocument();
    expect(screen.getByText("failures")).toBeInTheDocument();
  });

  it("shows running status with pulse animation class", () => {
    render(<StageProgress stages={stagesWithSummaries} />);
    // The running stage dot should have the animate-pulse class
    const { container } = render(<StageProgress stages={stagesWithSummaries} />);
    const pulseDots = container.querySelectorAll(".animate-pulse");
    expect(pulseDots.length).toBeGreaterThan(0);
  });
});
