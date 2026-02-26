"use client";

import type { UnifiedTask, DirectiveStatus, DirectivePriority, DirectiveType, TaskSource } from "@/types";
import StatusBadge from "./StatusBadge";

interface TaskListProps {
  tasks: UnifiedTask[];
}

const TYPE_STYLE: Record<DirectiveType, string> = {
  task: "bg-blue-950 text-blue-300 border-blue-800",
  focus: "bg-violet-950 text-violet-300 border-violet-800",
  policy: "bg-yellow-950 text-yellow-300 border-yellow-800",
};

const SOURCE_STYLE: Record<TaskSource, { label: string; class: string }> = {
  user: { label: "User", class: "bg-emerald-950 text-emerald-300 border-emerald-800" },
  agent: { label: "Agent", class: "bg-orange-950 text-orange-300 border-orange-800" },
};

const PRIORITY_STYLE: Record<DirectivePriority, string> = {
  urgent: "text-red-400",
  normal: "text-zinc-300",
  background: "text-zinc-500",
};

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
  acknowledged: "In Progress",
  pending: "Pending",
  deferred: "Blocked / Deferred",
  completed: "Completed",
  dismissed: "Dismissed",
};

function groupBySection(tasks: UnifiedTask[]): Map<SectionKey, UnifiedTask[]> {
  const groups = new Map<SectionKey, UnifiedTask[]>();

  for (const t of tasks) {
    let key: SectionKey = t.status;
    if (t.is_current) {
      key = "active";
    } else if (t.status === "acknowledged") {
      key = "acknowledged";
    }
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  // Sort completed reverse chronologically
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

function TaskCard({ task, isActive }: { task: UnifiedTask; isActive?: boolean }) {
  const source = SOURCE_STYLE[task.source];

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
        <StatusBadge status={task.status} />
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${source.class}`}
        >
          {source.label}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${TYPE_STYLE[task.type]}`}
        >
          {task.type}
        </span>
        {task.source === "user" && (
          <span className={`text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}>
            {task.priority}
          </span>
        )}
      </div>

      {/* Task text */}
      <p className="text-sm text-zinc-200 leading-snug">{task.text}</p>

      {/* Agent notes */}
      {task.agent_notes && (
        <p className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3 mt-1">
          {task.agent_notes}
        </p>
      )}

      {/* Dependencies */}
      {task.depends_on && task.depends_on.length > 0 && (
        <p className="text-[10px] text-zinc-600 mt-1">
          Depends on: {task.depends_on.join(", ")}
        </p>
      )}

      {/* Timestamps */}
      <div className="flex flex-wrap gap-3 text-[10px] text-zinc-600 mt-1">
        <span>Created {new Date(task.created_at).toLocaleString()}</span>
        {task.acknowledged_at && (
          <span>Acked {new Date(task.acknowledged_at).toLocaleString()}</span>
        )}
        {task.completed_at && (
          <span>Done {new Date(task.completed_at).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}

export default function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-zinc-500">No tasks yet.</p>;
  }

  const groups = groupBySection(tasks);

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
            {items.map((t) => (
              <TaskCard
                key={`${t.source}-${t.id}`}
                task={t}
                isActive={isActiveSection}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
