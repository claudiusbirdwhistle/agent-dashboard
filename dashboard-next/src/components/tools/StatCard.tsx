"use client";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "positive" | "negative";
}

export default function StatCard({ title, value, subtitle, trend }: StatCardProps) {
  const trendClass =
    trend === "positive"
      ? "text-emerald-400"
      : trend === "negative"
        ? "text-red-400"
        : "text-zinc-100";

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      <p className={`mt-1 text-2xl font-bold ${trendClass}`}>{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}
