"use client";

import { LineChart } from "@tremor/react";
import type { CustomTooltipProps } from "@tremor/react";
import type { EquityCurvePoint } from "./types";

interface EquityCurveChartProps {
  data: EquityCurvePoint[] | undefined;
}

function EquityCurveTooltip({ payload, active, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded p-2 text-xs shadow-lg min-w-[180px]">
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
          <span className="text-zinc-400 capitalize">{String(item.name)}</span>
          <span className="text-zinc-100 font-medium ml-auto pl-4">
            {typeof item.value === "number"
              ? `$${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "-"}
          </span>
        </div>
      ))}
    </div>
  );
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

  const hasSpy = data.some((point) => point.spy !== null);
  const categories = hasSpy ? ["portfolio", "spy", "equalWeight"] : ["portfolio", "equalWeight"];
  const colors = hasSpy ? ["emerald", "blue", "amber"] : ["emerald", "amber"];

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
        <LineChart
          data={cleanData}
          index="date"
          categories={categories}
          colors={colors}
          valueFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          className="h-64"
          showLegend={false}
          customTooltip={EquityCurveTooltip}
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
