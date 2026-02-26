"use client";

import { LineChart } from "@tremor/react";
import type { SignalHistoryEntry } from "./types";

interface SignalHistoryChartProps {
  data: SignalHistoryEntry[] | undefined;
}

/** Transform [{date, signals:[{ticker, compositeScore}]}] → [{date, AAPL: 0.82, MSFT: 0.71, ...}] */
function transformData(entries: SignalHistoryEntry[]) {
  // Collect all unique tickers across all dates
  const tickerSet = new Set<string>();
  for (const entry of entries) {
    for (const s of entry.signals) {
      tickerSet.add(s.ticker);
    }
  }
  const tickers = Array.from(tickerSet).sort();

  const rows = entries.map((entry) => {
    const row: Record<string, number | string> = { date: entry.date };
    for (const s of entry.signals) {
      row[s.ticker] = s.compositeScore;
    }
    return row;
  });

  return { rows, tickers };
}

// Tremor color palette — cycles if more tickers than colors
const COLORS = [
  "emerald", "blue", "amber", "rose", "violet",
  "cyan", "orange", "teal", "indigo", "pink",
];

export default function SignalHistoryChart({ data }: SignalHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          Signal History
        </h3>
        <p className="text-xs text-zinc-500 italic">No signal history data available.</p>
      </div>
    );
  }

  const { rows, tickers } = transformData(data);
  const colors = tickers.map((_, i) => COLORS[i % COLORS.length]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">
        Signal History
      </h3>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <LineChart
          data={rows}
          index="date"
          categories={tickers}
          colors={colors}
          valueFormatter={(v: number) => v.toFixed(4)}
          className="h-64"
        />
      </div>
    </div>
  );
}
