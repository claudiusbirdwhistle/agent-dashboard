"use client";

import type { Directive, DirectiveStatus, DirectivePriority, DirectiveType } from "@/types";
import StatusBadge from "./StatusBadge";

interface DirectiveListProps {
  directives: Directive[];
  onDelete: (id: string) => void;
  currentDirectiveId?: string | null;
}

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

/**
 * Display sections. "active" is a virtual section for the single directive
 * matching currentDirectiveId. Remaining acknowledged directives fall into
 * the regular "acknowledged" section.
 */
type SectionKey = DirectiveStatus | "active";

const SECTION_ORDER: SectionKey[] = [
  "active",
  "acknowledged",
  "pending",
  "deferred",
  "completed",
  "dismissed",
];

const SECTION_LABEL: Record<SectionKey, string> = {
  active: "Currently Working On",
  acknowledged: "Acknowledged",
  pending: "Pending",
  deferred: "Deferred",
  completed: "Completed",
  dismissed: "Dismissed",
};

function groupBySection(
  directives: Directive[],
  currentDirectiveId: string | null | undefined,
): Map<SectionKey, Directive[]> {
  const groups = new Map<SectionKey, Directive[]>();

  for (const d of directives) {
    // Acknowledged directives: split into "active" (the one being worked on)
    // vs "acknowledged" (queued but not the current focus).
    let key: SectionKey = d.status;
    if (d.status === "acknowledged") {
      key = currentDirectiveId && d.id === currentDirectiveId ? "active" : "acknowledged";
    }
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }

  // Sort completed items reverse chronologically (most recently completed first)
  const completed = groups.get("completed");
  if (completed) {
    completed.sort((a, b) => {
      const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return tb - ta;
    });
  }
  return groups;
}

function DirectiveCard({
  d,
  onDelete,
  isActive,
}: {
  d: Directive;
  onDelete: (id: string) => void;
  isActive?: boolean;
}) {
  return (
    <div
      className={`rounded border p-4 flex flex-col gap-2 ${
        isActive
          ? "border-cyan-700 bg-cyan-950/30"
          : "border-zinc-800 bg-zinc-900"
      }`}
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
  );
}

export default function DirectiveList({ directives, onDelete, currentDirectiveId }: DirectiveListProps) {
  if (directives.length === 0) {
    return <p className="text-sm text-zinc-500">No directives yet.</p>;
  }

  const groups = groupBySection(directives, currentDirectiveId);

  return (
    <div className="flex flex-col gap-6">
      {SECTION_ORDER.map((section) => {
        const items = groups.get(section);
        if (!items || items.length === 0) return null;

        const isActiveSection = section === "active";

        return (
          <section key={section} className="flex flex-col gap-3">
            <h3
              className={`text-xs font-semibold uppercase tracking-wider ${
                isActiveSection ? "text-cyan-400" : "text-zinc-500"
              }`}
            >
              {SECTION_LABEL[section]} ({items.length})
            </h3>
            {items.map((d) => (
              <DirectiveCard
                key={d.id}
                d={d}
                onDelete={onDelete}
                isActive={isActiveSection}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
