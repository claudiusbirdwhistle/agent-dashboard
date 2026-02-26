"use client";

import { useState, useMemo } from "react";
import { LineChart } from "@tremor/react";
import type { CustomTooltipProps } from "@tremor/react";
import type { SignalHistoryEntry } from "./types";

interface SignalHistoryChartProps {
  data: SignalHistoryEntry[] | undefined;
}

/** Transform [{date, signals:[{ticker, compositeScore}]}] → [{date, AAPL: 0.82, MSFT: 0.71, ...}] */
function transformData(entries: SignalHistoryEntry[]) {
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

// Distinct color palette cycling for many tickers
const COLORS = [
  "blue", "emerald", "amber", "rose", "violet",
  "cyan", "orange", "teal", "indigo", "pink",
  "fuchsia", "lime", "sky", "red", "yellow",
];

// Tailwind text classes for each color (for custom toggle buttons)
const COLOR_TEXT: Record<string, string> = {
  blue: "text-blue-400 border-blue-500",
  emerald: "text-emerald-400 border-emerald-500",
  amber: "text-amber-400 border-amber-500",
  rose: "text-rose-400 border-rose-500",
  violet: "text-violet-400 border-violet-500",
  cyan: "text-cyan-400 border-cyan-500",
  orange: "text-orange-400 border-orange-500",
  teal: "text-teal-400 border-teal-500",
  indigo: "text-indigo-400 border-indigo-500",
  pink: "text-pink-400 border-pink-500",
  fuchsia: "text-fuchsia-400 border-fuchsia-500",
  lime: "text-lime-400 border-lime-500",
  sky: "text-sky-400 border-sky-500",
  red: "text-red-400 border-red-500",
  yellow: "text-yellow-400 border-yellow-500",
};

function SignalHistoryTooltip({ payload, active, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded p-2 text-xs shadow-lg min-w-[160px] max-h-72 overflow-y-auto">
      <p className="text-zinc-300 mb-1.5 font-medium">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 py-0.5">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: item.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span className="text-zinc-400">{String(item.name)}</span>
          <span className="text-zinc-100 font-medium ml-auto pl-4">
            {typeof item.value === "number" ? item.value.toFixed(4) : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SignalHistoryChart({ data }: SignalHistoryChartProps) {
  const [selectedTickers, setSelectedTickers] = useState<Set<string> | null>(null);

  const { rows, tickers } = useMemo(() => {
    if (!data || data.length === 0) return { rows: [], tickers: [] };
    return transformData(data);
  }, [data]);

  // On first render or when tickers change, default to all selected
  const effectiveSelected = selectedTickers ?? new Set(tickers);

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

  const activeTickers = tickers.filter((t) => effectiveSelected.has(t));
  const activeColors = activeTickers.map((_, i) => COLORS[i % COLORS.length]);

  function toggleTicker(ticker: string) {
    const next = new Set(effectiveSelected);
    if (next.has(ticker)) {
      next.delete(ticker);
    } else {
      next.add(ticker);
    }
    setSelectedTickers(next);
  }

  function selectAll() {
    setSelectedTickers(new Set(tickers));
  }

  function selectNone() {
    setSelectedTickers(new Set());
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">
        Signal History
      </h3>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        {/* Ticker selector controls */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-500">Show tickers:</span>
            <button
              onClick={selectAll}
              className="text-xs px-2 py-0.5 rounded border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white transition-colors"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-xs px-2 py-0.5 rounded border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white transition-colors"
            >
              Select None
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {tickers.map((ticker, i) => {
              const color = COLORS[i % COLORS.length];
              const colorClass = COLOR_TEXT[color] ?? "text-zinc-400 border-zinc-500";
              const isSelected = effectiveSelected.has(ticker);
              return (
                <button
                  key={ticker}
                  onClick={() => toggleTicker(ticker)}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    isSelected
                      ? `${colorClass} bg-zinc-800`
                      : "text-zinc-600 border-zinc-700 bg-zinc-900"
                  }`}
                >
                  {ticker}
                </button>
              );
            })}
          </div>
        </div>

        {activeTickers.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-8 text-center">
            Select at least one ticker to display the chart.
          </p>
        ) : (
          <LineChart
            data={rows}
            index="date"
            categories={activeTickers}
            colors={activeColors}
            valueFormatter={(v: number) => v.toFixed(4)}
            className="h-64"
            showLegend={false}
            customTooltip={SignalHistoryTooltip}
          />
        )}
      </div>
    </div>
  );
}
