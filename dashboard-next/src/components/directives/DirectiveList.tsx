"use client";

import type { Directive, DirectiveStatus } from "@/types";
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
    return <p>No directives yet.</p>;
  }

  const groups = groupByStatus(directives);

  return (
    <div className="directive-list">
      {STATUS_ORDER.map((status) => {
        const items = groups.get(status);
        if (!items || items.length === 0) return null;
        return (
          <section key={status}>
            <h3>{status.charAt(0).toUpperCase() + status.slice(1)} ({items.length})</h3>
            {items.map((d) => (
              <div key={d.id} className="directive-card">
                <div className="directive-header">
                  <StatusBadge status={d.status} />
                  <span className="directive-type">{d.type}</span>
                  <span className="directive-priority">{d.priority}</span>
                  {d.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      aria-label="Delete"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="directive-text">{d.text}</p>
                {d.agent_notes && (
                  <p className="agent-notes">{d.agent_notes}</p>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
