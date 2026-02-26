"use client";

import { useState } from "react";
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

function DetailPanel({ detail }: { detail: Record<string, unknown> }) {
  return (
    <div className="mt-2 ml-5 bg-zinc-950 rounded border border-zinc-800 p-3 text-xs font-mono">
      <table className="w-full border-collapse">
        <tbody>
          {Object.entries(detail).map(([key, value]) => (
            <tr key={key} className="border-b border-zinc-800 last:border-0">
              <td className="py-1 pr-4 text-zinc-400 whitespace-nowrap">{key}</td>
              <td className="py-1 text-zinc-200 break-all">
                {Array.isArray(value)
                  ? value.length > 0
                    ? value.slice(0, 10).join(", ") + (value.length > 10 ? ` … (+${value.length - 10})` : "")
                    : "[]"
                  : typeof value === "object" && value !== null
                    ? JSON.stringify(value)
                    : String(value ?? "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface StageProgressProps {
  stages: StageResult[];
}

export default function StageProgress({ stages }: StageProgressProps) {
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  if (stages.length === 0) return null;

  const toggleDetail = (stage: string) =>
    setOpenDetail((prev) => (prev === stage ? null : stage));

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
          const hasDetail =
            stage.detail != null && Object.keys(stage.detail).length > 0;
          const isOpen = openDetail === stage.stage;

          return (
            <div key={stage.stage} className="px-4 py-3">
              <div className="flex items-start gap-3">
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
                  {hasDetail && (
                    <button
                      onClick={() => toggleDetail(stage.stage)}
                      className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                      aria-label={isOpen ? `close ${stage.stage} inspect` : `inspect ${stage.stage}`}
                    >
                      {isOpen ? "▲ hide details" : "▼ inspect"}
                    </button>
                  )}
                  {hasDetail && isOpen && (
                    <DetailPanel detail={stage.detail as Record<string, unknown>} />
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
