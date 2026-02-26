"use client";

import type { DbStats } from "./types";

interface Stat {
  label: string;
  value: number | string;
}

interface DbStatsPanelProps {
  stats: DbStats | undefined;
  isLoading: boolean;
}

export default function DbStatsPanel({ stats, isLoading }: DbStatsPanelProps) {
  if (isLoading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
        <p className="text-xs text-zinc-500">Loading database stats…</p>
      </div>
    );
  }

  if (!stats) return null;

  const rows: Stat[] = [
    { label: "Filings", value: stats.filings.toLocaleString() },
    { label: "Sections", value: stats.filingSections.toLocaleString() },
    { label: "Sentiment results", value: stats.sentimentResults.toLocaleString() },
    { label: "Similarity results", value: stats.similarityResults.toLocaleString() },
    { label: "Individual signals", value: stats.individualSignals.toLocaleString() },
    { label: "Composite signals", value: stats.compositeSignals.toLocaleString() },
  ];

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">Database State</h3>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            stats.dbExists
              ? "bg-emerald-900 text-emerald-300"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {stats.dbExists ? "connected" : "not found"}
        </span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          {rows.map(({ label, value }) => (
            <div key={label} className="bg-zinc-900 rounded p-2.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
              <p className="text-lg font-bold text-zinc-100 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        {stats.tickers.length > 0 && (
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
              Tickers in DB ({stats.tickers.length})
            </p>
            <p className="text-xs text-zinc-300 font-mono break-all">
              {stats.tickers.slice(0, 30).join(", ")}
              {stats.tickers.length > 30 && ` … +${stats.tickers.length - 30} more`}
            </p>
          </div>
        )}
        {stats.error && (
          <p className="text-xs text-amber-400 mt-2 font-mono">
            Note: {stats.error}
          </p>
        )}
      </div>
    </div>
  );
}
