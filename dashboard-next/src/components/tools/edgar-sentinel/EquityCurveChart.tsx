"use client";

import { AreaChart } from "@tremor/react";
import type { EquityCurvePoint } from "./types";

interface EquityCurveChartProps {
  data: EquityCurvePoint[] | undefined;
}

export default function EquityCurveChart({ data }: EquityCurveChartProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">
        Equity Curve
      </h3>
      {!data || data.length === 0 ? (
        <p className="text-xs text-zinc-500 italic">No equity curve data available.</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <AreaChart
            data={data}
            index="date"
            categories={["portfolio", "spy", "equalWeight"]}
            colors={["emerald", "blue", "amber"]}
            valueFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            className="h-64"
          />
          <div className="flex gap-4 mt-2 justify-center">
            <span className="text-[10px] text-emerald-400">● Portfolio</span>
            <span className="text-[10px] text-blue-400">● SPY</span>
            <span className="text-[10px] text-amber-400">● Equal-Weight</span>
          </div>
        </div>
      )}
    </div>
  );
}
