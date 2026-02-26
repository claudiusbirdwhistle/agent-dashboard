"use client";

import type { StageResult } from "./types";

const STAGE_META: Record<string, { label: string; color: string }> = {
  ingestion: { label: "Ingestion", color: "blue" },
  analysis: { label: "Analysis", color: "purple" },
  signals: { label: "Signal Generation", color: "green" },
  backtest: { label: "Backtest", color: "amber" },
};

function StatusDot({ status }: { status: StageResult["status"] }) {
  const colors: Record<string, string> = {
    pending: "bg-zinc-600",
    running: "bg-yellow-400 animate-pulse",
    completed: "bg-emerald-400",
    failed: "bg-red-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
}

interface StageProgressProps {
  stages: StageResult[];
}

export default function StageProgress({ stages }: StageProgressProps) {
  if (stages.length === 0) return null;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-300">Pipeline Progress</h3>
      </div>
      <div className="divide-y divide-zinc-800">
        {stages.map((stage) => {
          const meta = STAGE_META[stage.stage] ?? {
            label: stage.stage,
            color: "zinc",
          };
          return (
            <div
              key={stage.stage}
              className="px-4 py-3 flex items-start gap-3"
            >
              <div className="pt-1">
                <StatusDot status={stage.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  {meta.label}
                </p>
                {stage.summary && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {stage.summary}
                  </p>
                )}
                {stage.error && (
                  <p className="text-xs text-red-400 mt-0.5 font-mono">
                    {stage.error}
                  </p>
                )}
              </div>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  stage.status === "completed"
                    ? "bg-emerald-900 text-emerald-300"
                    : stage.status === "running"
                      ? "bg-yellow-900 text-yellow-300"
                      : stage.status === "failed"
                        ? "bg-red-900 text-red-300"
                        : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {stage.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
