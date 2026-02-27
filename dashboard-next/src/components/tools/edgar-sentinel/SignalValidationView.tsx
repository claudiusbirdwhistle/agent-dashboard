"use client";

import { useState } from "react";
import type {
  SignalValidationResults,
  ValidationTestResult,
  MultipleTestingRow,
} from "./types";

function PassFail({ pass: passed }: { pass: boolean }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
        passed
          ? "bg-emerald-900 text-emerald-300"
          : "bg-red-900 text-red-300"
      }`}
    >
      {passed ? "PASS" : "FAIL"}
    </span>
  );
}

function StatValue({
  label,
  value,
  decimals = 4,
}: {
  label: string;
  value: number | undefined | null;
  decimals?: number;
}) {
  if (value === undefined || value === null) return null;
  return (
    <span className="text-xs text-zinc-400">
      {label}={" "}
      <span className="text-zinc-200 font-mono">{value.toFixed(decimals)}</span>
    </span>
  );
}

function TestSection({
  title,
  horizonResults,
  getPass,
  renderStats,
}: {
  title: string;
  horizonResults: Record<string, ValidationTestResult> | undefined;
  getPass: (r: ValidationTestResult) => boolean;
  renderStats: (r: ValidationTestResult) => React.ReactNode;
}) {
  if (!horizonResults || Object.keys(horizonResults).length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1.5">
        {Object.entries(horizonResults).map(([horizon, result]) => (
          <div
            key={horizon}
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded px-3 py-2"
          >
            <PassFail pass={getPass(result)} />
            <span className="text-xs font-medium text-zinc-300 w-16">
              {horizon}
            </span>
            <div className="flex flex-wrap gap-3">{renderStats(result)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultipleTestingTable({ rows }: { rows: MultipleTestingRow[] }) {
  if (!rows || rows.length === 0) return null;

  const rejected = rows.filter((r) => r.rejected).length;

  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        Multiple Testing Correction (Benjamini-Hochberg)
      </h4>
      <p className="text-xs text-zinc-400 mb-2">
        {rejected}/{rows.length} tests survive FDR correction at alpha = 0.05
      </p>
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 uppercase">
                Test
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                p-value
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-500 uppercase">
                Adjusted p
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-500 uppercase">
                Significant
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((row) => (
              <tr key={row.test_name}>
                <td className="px-3 py-1.5 text-xs text-zinc-300 font-mono">
                  {row.test_name}
                </td>
                <td className="px-3 py-1.5 text-xs text-right font-mono text-zinc-400">
                  {row.original_p_value?.toFixed(4) ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-xs text-right font-mono text-zinc-400">
                  {row.adjusted_p_value?.toFixed(4) ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <PassFail pass={row.rejected ?? false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubgroupResults({
  subgroup_results,
}: {
  subgroup_results: Record<string, Record<string, ValidationTestResult>> | undefined;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!subgroup_results || Object.keys(subgroup_results).length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 hover:text-zinc-300 transition-colors"
      >
        {expanded ? "▲" : "▼"} Subgroup Analysis
      </button>
      {expanded && (
        <div className="space-y-3 mt-2">
          {Object.entries(subgroup_results).map(([groupName, results]) => (
            <div key={groupName}>
              <p className="text-xs font-medium text-zinc-300 mb-1">
                {groupName}
              </p>
              <div className="ml-2 space-y-1">
                {typeof results === "object" &&
                  results !== null &&
                  Object.entries(results).map(([subName, result]) => (
                    <div
                      key={subName}
                      className="flex items-center gap-2 text-xs text-zinc-400"
                    >
                      <span className="text-zinc-500 w-24 truncate">
                        {subName}:
                      </span>
                      {result && typeof result === "object" && "p_value" in result && (
                        <>
                          <PassFail pass={(result.p_value ?? 1) < 0.05} />
                          <StatValue label="p" value={result.p_value} />
                          <StatValue label="beta" value={result.beta} />
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SignalValidationViewProps {
  results: SignalValidationResults;
}

export default function SignalValidationView({
  results,
}: SignalValidationViewProps) {
  if (results.skipped) {
    return (
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          Signal Validation
        </h3>
        <p className="text-xs text-zinc-500">
          {results.error || "Validation was skipped due to insufficient data."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-zinc-300">
        Signal Validation Results
      </h3>

      {/* OLS Regression */}
      <TestSection
        title="OLS Predictive Regression (Newey-West)"
        horizonResults={results.ols_results}
        getPass={(r) => (r.p_value ?? 1) < 0.05}
        renderStats={(r) => (
          <>
            <StatValue label="β" value={r.beta} />
            <StatValue label="t" value={r.t_stat} decimals={2} />
            <StatValue label="p" value={r.p_value} />
            <StatValue label="R²" value={r.r_squared} />
          </>
        )}
      />

      {/* Information Coefficient */}
      <TestSection
        title="Information Coefficient (Spearman)"
        horizonResults={results.ic_results}
        getPass={(r) => Math.abs(r.ir ?? 0) > 0.5}
        renderStats={(r) => (
          <>
            <StatValue label="IC" value={r.mean_ic} />
            <StatValue label="IR" value={r.ir} decimals={2} />
            <StatValue label="% pos" value={r.pct_positive} decimals={1} />
            <StatValue label="t" value={r.t_stat} decimals={2} />
          </>
        )}
      />

      {/* Portfolio Sorts */}
      <TestSection
        title="Portfolio Sorts (Quintile Long-Short)"
        horizonResults={results.portfolio_sort_results}
        getPass={(r) => (r.spread_p_value ?? 1) < 0.05}
        renderStats={(r) => (
          <>
            <StatValue label="spread" value={r.spread_mean} />
            <StatValue label="t" value={r.spread_t_stat} decimals={2} />
            <StatValue label="p" value={r.spread_p_value} />
            <StatValue label="Sharpe" value={r.spread_sharpe} decimals={2} />
            <StatValue label="JT" value={r.jt_statistic} decimals={2} />
          </>
        )}
      />

      {/* Fama-MacBeth */}
      <TestSection
        title="Fama-MacBeth Cross-Sectional Regression"
        horizonResults={results.fama_macbeth_results}
        getPass={(r) => (r.p_value ?? 1) < 0.05}
        renderStats={(r) => (
          <>
            <StatValue label="coef" value={r.mean_coefficient} />
            <StatValue label="FM-t" value={r.fm_t_stat} decimals={2} />
            <StatValue label="p" value={r.p_value} />
          </>
        )}
      />

      {/* Granger Causality */}
      <TestSection
        title="Panel Granger Causality"
        horizonResults={results.granger_results}
        getPass={(r) => (r.p_value ?? 1) < 0.05}
        renderStats={(r) => (
          <>
            <StatValue label="χ²" value={r.test_statistic} decimals={2} />
            <StatValue label="p" value={r.p_value} />
          </>
        )}
      />

      {/* Out-of-Sample */}
      <TestSection
        title="Out-of-Sample Validation (Expanding Window)"
        horizonResults={results.oos_results}
        getPass={(r) => (r.oos_r_squared ?? 0) > 0}
        renderStats={(r) => (
          <>
            <StatValue label="OOS R²" value={r.oos_r_squared} />
            <StatValue label="hit rate" value={r.directional_hit_rate} decimals={2} />
            <StatValue label="OOS Sharpe" value={r.oos_sharpe} decimals={2} />
            <StatValue label="IS R²" value={r.is_r_squared} />
            {r.overfit_flag && (
              <span className="text-[10px] text-amber-400 font-bold">
                OVERFIT WARNING
              </span>
            )}
          </>
        )}
      />

      {/* Multiple Testing Correction */}
      <MultipleTestingTable rows={results.multiple_testing_table ?? []} />

      {/* Subgroup Analysis */}
      <SubgroupResults subgroup_results={results.subgroup_results} />
    </div>
  );
}
