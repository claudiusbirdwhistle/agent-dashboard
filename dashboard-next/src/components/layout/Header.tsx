"use client";

import { useStatus, useToggleAgent } from "@/lib/hooks/useStatus";

export default function Header() {
  const { data: status } = useStatus();
  const toggle = useToggleAgent();

  const enabled = status?.enabled ?? false;
  const phase = status?.phase ?? "—";
  const invocations = status?.invocations ?? 0;
  const stalls = status?.stalls ?? 0;

  return (
    <header className="flex items-center gap-6 px-6 py-3 bg-zinc-900 border-b border-zinc-800">
      {/* Title */}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-white">Agent Dashboard</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Phase: {phase}</p>
      </div>

      {/* KPIs */}
      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="text-zinc-500 text-xs">Status</p>
          <p className={`font-semibold ${enabled ? "text-green-400" : "text-red-400"}`}>
            {enabled ? "● Running" : "● Stopped"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-zinc-500 text-xs">Invocations</p>
          <p className="text-white font-semibold">{invocations}</p>
        </div>
        <div className="text-center">
          <p className="text-zinc-500 text-xs">Stalls</p>
          <p className="text-white font-semibold">{stalls}</p>
        </div>
        {status?.disk_usage && (
          <div className="text-center">
            <p className="text-zinc-500 text-xs">Disk</p>
            <p className="text-white font-semibold">{status.disk_usage}</p>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          enabled
            ? "bg-red-900 text-red-300 hover:bg-red-800"
            : "bg-green-900 text-green-300 hover:bg-green-800"
        }`}
      >
        {toggle.isPending ? "…" : enabled ? "Disable" : "Enable"}
      </button>
    </header>
  );
}
