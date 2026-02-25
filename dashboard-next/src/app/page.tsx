"use client";

import { useStatus } from "@/lib/hooks/useStatus";
import EventStream from "@/components/live/EventStream";

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "green" | "red" | "zinc";
}) {
  const colorMap = {
    green: "text-green-400",
    red: "text-red-400",
    zinc: "text-white",
  } as const;
  const color = colorMap[accent ?? "zinc"];

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 px-5 py-4 flex flex-col gap-1">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function HomePage() {
  const { data: status } = useStatus();

  const enabled = status?.enabled ?? false;
  const processStatus = status?.processStatus ?? "idle";
  const phase = status?.phase ?? "—";
  const invocations = status?.totalInvocations ?? "—";
  const stalls = status?.stallCount ?? "—";
  const activeObjectives = status?.activeObjectives ?? "—";
  const disk = status?.diskUsage ? `${status.diskUsage.used} / ${status.diskUsage.percent}` : null;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* KPI grid */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">
          Agent Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Status"
            value={enabled ? processStatus : "stopped"}
            accent={enabled ? "green" : "red"}
          />
          <KpiCard label="Phase" value={phase} />
          <KpiCard label="Invocations" value={invocations} />
          <KpiCard label="Active Goals" value={activeObjectives} />
          <KpiCard label="Stalls" value={stalls} />
          {disk && <KpiCard label="Disk" value={disk} />}
        </div>
      </section>

      {/* Live event stream */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">
          Live Output
        </h2>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
          <EventStream />
        </div>
      </section>
    </div>
  );
}
