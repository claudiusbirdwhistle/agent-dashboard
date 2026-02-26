"use client";

import { useState } from "react";
import type { PortfolioSnapshot } from "./types";

interface PortfolioHistoryViewProps {
  data: PortfolioSnapshot[] | undefined;
}

function fmt$(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function PortfolioHistoryView({ data }: PortfolioHistoryViewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function toggleRow(index: number) {
    setExpandedIndex(expandedIndex === index ? null : index);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">
        Portfolio History
      </h3>
      {!data || data.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No portfolio history available.</p>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-5 bg-zinc-900 border-b border-zinc-800 px-3 py-2">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase">Date</span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase text-right">Value</span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase text-right">Turnover</span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase text-right">Tx Cost</span>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase text-right">L / S</span>
          </div>
          {data.map((snapshot, i) => (
            <div key={snapshot.rebalanceDate} className="border-b border-zinc-800 last:border-0">
              {/* Summary row — clickable */}
              <div
                className="grid grid-cols-5 px-3 py-2 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                onClick={() => toggleRow(i)}
                role="button"
                aria-expanded={expandedIndex === i}
              >
                <span className="text-xs text-zinc-300 font-mono">
                  {snapshot.rebalanceDate}
                </span>
                <span className="text-xs text-zinc-200 font-mono text-right">
                  {fmt$(snapshot.portfolioValue)}
                </span>
                <span className="text-xs text-zinc-400 font-mono text-right">
                  {fmtPct(snapshot.turnover)}
                </span>
                <span className="text-xs text-zinc-400 font-mono text-right">
                  {fmt$(snapshot.transactionCost)}
                </span>
                <span className="text-xs text-zinc-400 font-mono text-right">
                  {snapshot.nLong} / {snapshot.nShort}
                </span>
              </div>

              {/* Expanded positions panel */}
              {expandedIndex === i && snapshot.positions.length > 0 && (
                <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-3">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="pb-1 text-left text-[10px] font-semibold text-zinc-500 uppercase">Ticker</th>
                        <th className="pb-1 text-right text-[10px] font-semibold text-zinc-500 uppercase">Weight</th>
                        <th className="pb-1 text-right text-[10px] font-semibold text-zinc-500 uppercase">Value</th>
                        <th className="pb-1 text-right text-[10px] font-semibold text-zinc-500 uppercase">Score</th>
                        <th className="pb-1 text-right text-[10px] font-semibold text-zinc-500 uppercase">Q</th>
                        <th className="pb-1 text-right text-[10px] font-semibold text-zinc-500 uppercase">Leg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {snapshot.positions.map((pos) => (
                        <tr key={pos.ticker}>
                          <td className="py-1 text-xs font-mono text-zinc-200">{pos.ticker}</td>
                          <td className="py-1 text-xs font-mono text-zinc-300 text-right">
                            {fmtPct(pos.weight)}
                          </td>
                          <td className="py-1 text-xs font-mono text-zinc-300 text-right">
                            {fmt$(pos.dollarValue)}
                          </td>
                          <td className="py-1 text-xs font-mono text-zinc-400 text-right">
                            {pos.signalScore.toFixed(4)}
                          </td>
                          <td className="py-1 text-xs font-mono text-zinc-400 text-right">
                            {pos.quantile}
                          </td>
                          <td className="py-1 text-right">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                pos.leg === "long"
                                  ? "bg-emerald-900/50 text-emerald-400"
                                  : "bg-red-900/50 text-red-400"
                              }`}
                            >
                              {pos.leg}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
