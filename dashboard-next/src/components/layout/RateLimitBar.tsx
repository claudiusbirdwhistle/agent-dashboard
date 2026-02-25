"use client";

import { useRateLimits } from "@/lib/hooks/useRateLimits";

function getBarColor(utilization: number): string {
  if (utilization >= 0.9) return "bg-red-500";
  if (utilization >= 0.75) return "bg-amber-500";
  return "bg-green-500";
}

function getTextColor(utilization: number): string {
  if (utilization >= 0.9) return "text-red-400";
  if (utilization >= 0.75) return "text-amber-400";
  return "text-green-400";
}

function formatResetTime(resetsAt: string | null): string | null {
  if (!resetsAt) return null;
  const reset = new Date(resetsAt);
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();
  if (diffMs <= 0) return "resets soon";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `resets in ${days}d ${hours % 24}h`;
  return `resets in ${hours}h`;
}

export default function RateLimitBar() {
  const { data } = useRateLimits();

  if (!data || data.utilization === null) return null;

  const pct = Math.round(data.utilization * 100);
  const label = data.type === "seven_day" ? "Weekly" : data.type === "daily" ? "Daily" : "Rate";
  const resetStr = formatResetTime(data.resetsAt);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-500">{label}</span>
      <div className="w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(data.utilization)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`font-semibold ${getTextColor(data.utilization)}`}>
        {pct}%
      </span>
      {resetStr && <span className="text-zinc-600">{resetStr}</span>}
    </div>
  );
}
