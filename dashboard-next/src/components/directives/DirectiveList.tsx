"use client";

import type { Directive, DirectiveStatus, DirectivePriority, DirectiveType } from "@/types";
import StatusBadge from "./StatusBadge";

interface DirectiveListProps {
  directives: Directive[];
  onDelete: (id: string) => void;
}

const STATUS_ORDER: DirectiveStatus[] = [
  "pending",
  "acknowledged",
  "completed",
  "deferred",
  "dismissed",
];

const TYPE_STYLE: Record<DirectiveType, string> = {
  task: "bg-blue-950 text-blue-300 border-blue-800",
  focus: "bg-violet-950 text-violet-300 border-violet-800",
  policy: "bg-yellow-950 text-yellow-300 border-yellow-800",
};

const PRIORITY_STYLE: Record<DirectivePriority, string> = {
  urgent: "text-red-400",
  normal: "text-zinc-300",
  background: "text-zinc-500",
};

function groupByStatus(directives: Directive[]): Map<DirectiveStatus, Directive[]> {
  const groups = new Map<DirectiveStatus, Directive[]>();
  for (const d of directives) {
    const list = groups.get(d.status) ?? [];
    list.push(d);
    groups.set(d.status, list);
  }
  return groups;
}

export default function DirectiveList({ directives, onDelete }: DirectiveListProps) {
  if (directives.length === 0) {
    return <p className="text-sm text-zinc-500">No directives yet.</p>;
  }

  const groups = groupByStatus(directives);

  return (
    <div className="flex flex-col gap-6">
      {STATUS_ORDER.map((status) => {
        const items = groups.get(status);
        if (!items || items.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {status.charAt(0).toUpperCase() + status.slice(1)} ({items.length})
            </h3>
            {items.map((d) => (
              <div
                key={d.id}
                className="rounded border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-2"
              >
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={d.status} />
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${TYPE_STYLE[d.type]}`}
                  >
                    {d.type}
                  </span>
                  <span className={`text-xs font-medium ${PRIORITY_STYLE[d.priority]}`}>
                    {d.priority}
                  </span>
                  {d.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      aria-label="Delete directive"
                      className="ml-auto px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950 rounded border border-red-800 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Directive text */}
                <p className="text-sm text-zinc-200 leading-snug">{d.text}</p>

                {/* Agent notes */}
                {d.agent_notes && (
                  <p className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3 mt-1">
                    {d.agent_notes}
                  </p>
                )}

                {/* Timestamps */}
                <div className="flex flex-wrap gap-3 text-[10px] text-zinc-600 mt-1">
                  <span>Created {new Date(d.created_at).toLocaleString()}</span>
                  {d.acknowledged_at && (
                    <span>Acked {new Date(d.acknowledged_at).toLocaleString()}</span>
                  )}
                  {d.completed_at && (
                    <span>Done {new Date(d.completed_at).toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
