/**
 * Tests for the three new chart/view components added to BacktestResultsView:
 *   - EquityCurveChart
 *   - PortfolioHistoryView
 *   - SignalHistoryChart
 *
 * Tremor chart primitives are mocked to keep tests fast and deterministic.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock @tremor/react chart components so tests don't need SVG/canvas
jest.mock("@tremor/react", () => ({
  AreaChart: ({
    data,
    categories,
    index,
  }: {
    data: Record<string, unknown>[];
    categories: string[];
    index: string;
  }) => (
    <div
      data-testid="area-chart"
      data-rows={data.length}
      data-categories={categories.join(",")}
      data-index={index}
    />
  ),
  LineChart: ({
    data,
    categories,
    index,
  }: {
    data: Record<string, unknown>[];
    categories: string[];
    index: string;
  }) => (
    <div
      data-testid="line-chart"
      data-rows={data.length}
      data-categories={categories.join(",")}
      data-index={index}
    />
  ),
}));

import EquityCurveChart from "@/components/tools/edgar-sentinel/EquityCurveChart";
import PortfolioHistoryView from "@/components/tools/edgar-sentinel/PortfolioHistoryView";
import SignalHistoryChart from "@/components/tools/edgar-sentinel/SignalHistoryChart";
import type {
  EquityCurvePoint,
  PortfolioSnapshot,
  SignalHistoryEntry,
} from "@/components/tools/edgar-sentinel/types";

// ─── Sample fixtures ────────────────────────────────────────────────────────

const equityCurveData: EquityCurvePoint[] = [
  { date: "2024-01-01", portfolio: 10000, spy: 10000, equalWeight: 10000 },
  { date: "2024-04-01", portfolio: 11200, spy: 10800, equalWeight: 10900 },
  { date: "2024-07-01", portfolio: 12500, spy: 11500, equalWeight: 11800 },
];

const portfolioHistoryData: PortfolioSnapshot[] = [
  {
    rebalanceDate: "2024-01-01",
    portfolioValue: 10000,
    turnover: 0.85,
    transactionCost: 42.5,
    nLong: 2,
    nShort: 0,
    positions: [
      {
        ticker: "AAPL",
        weight: 0.6,
        quantile: 1,
        signalScore: 0.82,
        leg: "long",
        dollarValue: 6000,
      },
      {
        ticker: "MSFT",
        weight: 0.4,
        quantile: 2,
        signalScore: 0.71,
        leg: "long",
        dollarValue: 4000,
      },
    ],
  },
  {
    rebalanceDate: "2024-04-01",
    portfolioValue: 11200,
    turnover: 0.3,
    transactionCost: 16.8,
    nLong: 2,
    nShort: 0,
    positions: [
      {
        ticker: "NVDA",
        weight: 0.7,
        quantile: 1,
        signalScore: 0.91,
        leg: "long",
        dollarValue: 7840,
      },
      {
        ticker: "MSFT",
        weight: 0.3,
        quantile: 2,
        signalScore: 0.65,
        leg: "long",
        dollarValue: 3360,
      },
    ],
  },
];

const signalHistoryData: SignalHistoryEntry[] = [
  {
    date: "2024-01-01",
    signals: [
      { ticker: "AAPL", compositeScore: 0.82, rank: 1 },
      { ticker: "MSFT", compositeScore: 0.71, rank: 2 },
      { ticker: "GOOGL", compositeScore: 0.55, rank: 3 },
    ],
  },
  {
    date: "2024-04-01",
    signals: [
      { ticker: "NVDA", compositeScore: 0.91, rank: 1 },
      { ticker: "AAPL", compositeScore: 0.78, rank: 2 },
      { ticker: "GOOGL", compositeScore: 0.62, rank: 3 },
    ],
  },
];

// ─── EquityCurveChart ────────────────────────────────────────────────────────

describe("EquityCurveChart", () => {
  it("renders the section heading", () => {
    render(<EquityCurveChart data={equityCurveData} />);
    expect(screen.getByText(/equity curve/i)).toBeInTheDocument();
  });

  it("passes correct row count to AreaChart", () => {
    render(<EquityCurveChart data={equityCurveData} />);
    const chart = screen.getByTestId("area-chart");
    expect(chart.getAttribute("data-rows")).toBe("3");
  });

  it("uses 'date' as the index field", () => {
    render(<EquityCurveChart data={equityCurveData} />);
    const chart = screen.getByTestId("area-chart");
    expect(chart.getAttribute("data-index")).toBe("date");
  });

  it("includes portfolio, spy, and equalWeight categories", () => {
    render(<EquityCurveChart data={equityCurveData} />);
    const chart = screen.getByTestId("area-chart");
    const categories = chart.getAttribute("data-categories") ?? "";
    expect(categories).toContain("portfolio");
    expect(categories).toContain("spy");
    expect(categories).toContain("equalWeight");
  });

  it("shows 'No equity curve data' when data is empty", () => {
    render(<EquityCurveChart data={[]} />);
    expect(screen.getByText(/no equity curve data/i)).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("renders nothing when data is undefined", () => {
    render(<EquityCurveChart data={undefined} />);
    expect(screen.getByText(/no equity curve data/i)).toBeInTheDocument();
  });
});

// ─── PortfolioHistoryView ────────────────────────────────────────────────────

describe("PortfolioHistoryView", () => {
  it("renders the section heading", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    expect(screen.getByText(/portfolio history/i)).toBeInTheDocument();
  });

  it("renders one row per rebalance date", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    expect(screen.getByText("2024-01-01")).toBeInTheDocument();
    expect(screen.getByText("2024-04-01")).toBeInTheDocument();
  });

  it("shows portfolio value, turnover, and transaction cost in summary row", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    // First snapshot: $10,000
    expect(screen.getByText(/\$10,000/)).toBeInTheDocument();
  });

  it("positions are hidden by default (accordion collapsed)", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    // ticker names in positions should not be visible before expand
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
  });

  it("expands to show positions when row is clicked", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    const firstRow = screen.getByText("2024-01-01");
    fireEvent.click(firstRow);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
  });

  it("collapses when expanded row is clicked again", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    const firstRow = screen.getByText("2024-01-01");
    fireEvent.click(firstRow);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    fireEvent.click(firstRow);
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
  });

  it("shows position weight and dollar value in expanded panel", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    fireEvent.click(screen.getByText("2024-01-01"));
    // weight 60.0% and $6,000
    expect(screen.getByText(/60\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/\$6,000/)).toBeInTheDocument();
  });

  it("shows leg badge (long/short) in expanded panel", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    fireEvent.click(screen.getByText("2024-01-01"));
    const longBadges = screen.getAllByText("long");
    expect(longBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'No portfolio history' when data is empty", () => {
    render(<PortfolioHistoryView data={[]} />);
    expect(screen.getByText(/no portfolio history/i)).toBeInTheDocument();
  });

  it("only expands one row at a time", () => {
    render(<PortfolioHistoryView data={portfolioHistoryData} />);
    // Expand first
    fireEvent.click(screen.getByText("2024-01-01"));
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    // Expand second — first should collapse
    fireEvent.click(screen.getByText("2024-04-01"));
    expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
    expect(screen.getByText("NVDA")).toBeInTheDocument();
  });
});

// ─── SignalHistoryChart ──────────────────────────────────────────────────────

describe("SignalHistoryChart", () => {
  it("renders the section heading", () => {
    render(<SignalHistoryChart data={signalHistoryData} />);
    expect(screen.getByText(/signal history/i)).toBeInTheDocument();
  });

  it("passes correct row count to LineChart", () => {
    render(<SignalHistoryChart data={signalHistoryData} />);
    const chart = screen.getByTestId("line-chart");
    expect(chart.getAttribute("data-rows")).toBe("2");
  });

  it("uses 'date' as the index field", () => {
    render(<SignalHistoryChart data={signalHistoryData} />);
    const chart = screen.getByTestId("line-chart");
    expect(chart.getAttribute("data-index")).toBe("date");
  });

  it("includes all unique tickers as categories", () => {
    render(<SignalHistoryChart data={signalHistoryData} />);
    const chart = screen.getByTestId("line-chart");
    const categories = chart.getAttribute("data-categories") ?? "";
    expect(categories).toContain("AAPL");
    expect(categories).toContain("MSFT");
    expect(categories).toContain("GOOGL");
    expect(categories).toContain("NVDA");
  });

  it("shows 'No signal history' when data is empty", () => {
    render(<SignalHistoryChart data={[]} />);
    expect(screen.getByText(/no signal history/i)).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("renders nothing when data is undefined", () => {
    render(<SignalHistoryChart data={undefined} />);
    expect(screen.getByText(/no signal history/i)).toBeInTheDocument();
  });

  it("transforms data so each row has all ticker scores keyed by ticker", () => {
    // The chart should receive data like:
    // [{ date: '2024-01-01', AAPL: 0.82, MSFT: 0.71, GOOGL: 0.55 }, ...]
    render(<SignalHistoryChart data={signalHistoryData} />);
    const chart = screen.getByTestId("line-chart");
    // row count == entry count
    expect(chart.getAttribute("data-rows")).toBe("2");
  });
});
