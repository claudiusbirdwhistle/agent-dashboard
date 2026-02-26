"use client";

import type { BacktestResults } from "./types";
import EquityCurveChart from "./EquityCurveChart";
import PortfolioHistoryView from "./PortfolioHistoryView";
import SignalHistoryChart from "./SignalHistoryChart";

function MetricCard({
  label,
  value,
  format = "percent",
  positive,
}: {
  label: string;
  value: number;
  format?: "percent" | "ratio" | "number";
  positive?: "higher" | "lower";
}) {
  const formatted =
    format === "percent"
      ? `${(value * 100).toFixed(1)}%`
      : format === "ratio"
        ? value.toFixed(3)
        : value.toFixed(1);

  const isGood =
    positive === "higher" ? value > 0 : positive === "lower" ? value < 0 : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-lg font-bold mt-0.5 ${
          isGood === true
            ? "text-emerald-400"
            : isGood === false
              ? "text-red-400"
              : "text-zinc-200"
        }`}
      >
        {formatted}
      </p>
    </div>
  );
}

function BenchmarkRow({
  label,
  metrics,
  highlight,
}: {
  label: string;
  metrics: { totalReturn: number; annualizedReturn: number; sharpeRatio: number };
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-zinc-800/50" : ""}>
      <td className="px-3 py-2 text-xs text-zinc-300 font-medium">{label}</td>
      <td className="px-3 py-2 text-xs text-right font-mono">
        <span className={metrics.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
          {(metrics.totalReturn * 100).toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-right font-mono">
        <span className={metrics.annualizedReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
          {(metrics.annualizedReturn * 100).toFixed(1)}%
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-right font-mono text-zinc-300">
        {metrics.sharpeRatio.toFixed(3)}
      </td>
    </tr>
  );
}

interface BacktestResultsViewProps {
  results: BacktestResults;
}

export default function BacktestResultsView({
  results,
}: BacktestResultsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Strategy Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          Strategy Performance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard
            label="Total Return"
            value={results.strategy.totalReturn}
            positive="higher"
          />
          <MetricCard
            label="Annualized"
            value={results.strategy.annualizedReturn}
            positive="higher"
          />
          <MetricCard
            label="Sharpe Ratio"
            value={results.strategy.sharpeRatio}
            format="ratio"
            positive="higher"
          />
          <MetricCard
            label="Max Drawdown"
            value={results.strategy.maxDrawdown}
            positive="lower"
          />
          <MetricCard
            label="Sortino Ratio"
            value={results.strategy.sortinoRatio}
            format="ratio"
            positive="higher"
          />
          <MetricCard
            label="Win Rate"
            value={results.strategy.winRate}
            positive="higher"
          />
          <MetricCard
            label="Info Coefficient"
            value={results.strategy.informationCoefficient}
            format="ratio"
          />
        </div>
      </div>

      {/* Benchmark Comparison */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          Benchmark Comparison
        </h3>
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 uppercase">
                  Strategy
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                  Total Return
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                  Annualized
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                  Sharpe
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              <BenchmarkRow
                label="EDGAR Signal"
                metrics={results.strategy}
                highlight
              />
              <BenchmarkRow
                label="SPY Buy & Hold"
                metrics={results.benchmarks.spy}
              />
              <BenchmarkRow
                label="Equal-Weight B&H"
                metrics={results.benchmarks.equalWeight}
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Period Returns */}
      {results.monthlyReturns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">
            Period Returns
          </h3>
          <div className="border border-zinc-800 rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 uppercase">
                    Period End
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                    Strategy
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                    SPY
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                    Equal-Wt
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                    Excess (vs SPY)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {results.monthlyReturns.map((row) => {
                  const excess = row.strategy - row.spy;
                  return (
                    <tr key={row.month}>
                      <td className="px-3 py-1.5 text-xs text-zinc-400 font-mono">
                        {row.month}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono">
                        <span
                          className={
                            row.strategy >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {(row.strategy * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono text-zinc-400">
                        {(row.spy * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono text-zinc-400">
                        {(row.equalWeight * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono">
                        <span
                          className={
                            excess >= 0 ? "text-emerald-400" : "text-red-400"
                          }
                        >
                          {excess >= 0 ? "+" : ""}
                          {(excess * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Signal Rankings */}
      {results.signalRankings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">
            Latest Signal Rankings
          </h3>
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 uppercase">
                    Rank
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 uppercase">
                    Ticker
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                    Composite Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {results.signalRankings.map((row) => (
                  <tr key={row.ticker}>
                    <td className="px-3 py-1.5 text-xs text-zinc-400">
                      #{row.rank}
                    </td>
                    <td className="px-3 py-1.5 text-xs font-medium text-zinc-200 font-mono">
                      {row.ticker}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-right font-mono">
                      <span
                        className={
                          row.compositeScore >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        {row.compositeScore.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Equity Curve Chart */}
      <EquityCurveChart data={results.equityCurve} />

      {/* Portfolio History */}
      <PortfolioHistoryView data={results.portfolioHistory} />

      {/* Signal History Chart */}
      <SignalHistoryChart data={results.signalHistory} />
    </div>
  );
}
