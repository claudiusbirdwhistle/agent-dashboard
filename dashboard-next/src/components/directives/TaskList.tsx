"use client";

import { useState } from "react";
import type { UnifiedTask, DirectiveStatus, DirectivePriority, DirectiveType, TaskSource } from "@/types";
import StatusBadge from "./StatusBadge";

interface TaskListProps {
  tasks: UnifiedTask[];
  onEdit?: (id: string, data: { text: string; type: DirectiveType; priority: DirectivePriority }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
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

const TYPES: { value: DirectiveType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "focus", label: "Focus" },
  { value: "policy", label: "Policy" },
];

const PRIORITIES: { value: DirectivePriority; label: string; activeClass: string; idleClass: string }[] = [
  {
    value: "urgent",
    label: "Urgent",
    activeClass: "border-red-500 bg-red-950 text-red-300",
    idleClass: "border-zinc-700 text-zinc-400 hover:border-red-700 hover:text-red-400",
  },
  {
    value: "normal",
    label: "Normal",
    activeClass: "border-zinc-400 bg-zinc-800 text-white",
    idleClass: "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
  },
  {
    value: "background",
    label: "Background",
    activeClass: "border-zinc-600 bg-zinc-800 text-zinc-300",
    idleClass: "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400",
  },
];

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

function TaskCard({
  task,
  isActive,
  onEdit,
  onDelete,
}: {
  task: UnifiedTask;
  isActive?: boolean;
  onEdit?: (id: string, data: { text: string; type: DirectiveType; priority: DirectivePriority }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const source = SOURCE_STYLE[task.source];
  const canEdit = task.source === "user" && task.status === "pending" && !!onEdit;
  const canDelete = task.source === "user" && task.status === "pending" && !!onDelete;

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editType, setEditType] = useState<DirectiveType>(task.type);
  const [editPriority, setEditPriority] = useState<DirectivePriority>(task.priority);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function startEdit() {
    setEditText(task.text);
    setEditType(task.type);
    setEditPriority(task.priority);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!editText.trim() || !onEdit) return;
    setSaving(true);
    try {
      await onEdit(task.id, { text: editText.trim(), type: editType, priority: editPriority });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
    } finally {
      setDeleting(false);
    }
  }

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
        {(canEdit || canDelete) && !editing && (
          <div className="ml-auto flex gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={startEdit}
                aria-label="Edit directive"
                className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded border border-zinc-700 transition-colors"
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete directive"
                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950 rounded border border-red-800 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        /* Inline edit form */
        <div className="flex flex-col gap-3 mt-1">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-y"
          />
          {/* Type selector */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Type</p>
            <div className="flex gap-2">
              {TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEditType(value)}
                  className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
                    editType === value
                      ? "border-blue-500 bg-blue-950 text-blue-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Priority selector */}
          <div className={`flex flex-col gap-1 transition-opacity ${editType === "policy" ? "opacity-40 pointer-events-none" : ""}`}>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Priority{editType === "policy" ? " (n/a for policies)" : ""}
            </p>
            <div className="flex gap-2">
              {PRIORITIES.map(({ value, label, activeClass, idleClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEditPriority(value)}
                  disabled={editType === "policy"}
                  className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
                    editPriority === value ? activeClass : idleClass
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving || !editText.trim()}
              className="flex-1 rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="flex-1 rounded border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Normal display */
        <p className="text-sm text-zinc-200 leading-snug">{task.text}</p>
      )}

      {/* Agent notes */}
      {!editing && task.agent_notes && (
        <p className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3 mt-1">
          {task.agent_notes}
        </p>
      )}

      {/* Dependencies */}
      {!editing && task.depends_on && task.depends_on.length > 0 && (
        <p className="text-[10px] text-zinc-600 mt-1">
          Depends on: {task.depends_on.join(", ")}
        </p>
      )}

      {/* Timestamps */}
      {!editing && (
        <div className="flex flex-wrap gap-3 text-[10px] text-zinc-600 mt-1">
          <span>Created {new Date(task.created_at).toLocaleString()}</span>
          {task.acknowledged_at && (
            <span>Acked {new Date(task.acknowledged_at).toLocaleString()}</span>
          )}
          {task.completed_at && (
            <span>Done {new Date(task.completed_at).toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
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
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
