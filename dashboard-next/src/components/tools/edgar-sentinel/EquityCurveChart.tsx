"use client";

import { AreaChart } from "@tremor/react";
import type { EquityCurvePoint } from "./types";

interface EquityCurveChartProps {
  data: EquityCurvePoint[] | undefined;
}

export default function EquityCurveChart({ data }: EquityCurveChartProps) {
  if (!data || data.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          Equity Curve
        </h3>
        <p className="text-xs text-zinc-500 italic">No equity curve data available.</p>
      </div>
    );
  }

  // Transform data to replace null spy values with undefined (which tremor skips)
  // or filter categories based on whether spy data exists
  const hasSpy = data.some((point) => point.spy !== null);
  const categories = hasSpy ? ["portfolio", "spy", "equalWeight"] : ["portfolio", "equalWeight"];
  const colors = hasSpy ? ["emerald", "blue", "amber"] : ["emerald", "amber"];

  // Clean data: replace null spy with undefined if needed (tremor skips undefined in categories)
  const cleanData = data.map((point) => ({
    ...point,
    spy: point.spy ?? undefined,
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">
        Equity Curve
      </h3>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <AreaChart
          data={cleanData}
          index="date"
          categories={categories}
          colors={colors}
          valueFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          className="h-64"
        />
        <div className="flex gap-4 mt-2 justify-center">
          <span className="text-[10px] text-emerald-400">● Portfolio</span>
          {hasSpy && <span className="text-[10px] text-blue-400">● SPY</span>}
          <span className="text-[10px] text-amber-400">● Equal-Weight</span>
        </div>
      </div>
    </div>
  );
}
