import type { DirectiveStatus } from "@/types";

const STATUS_LABELS: Record<DirectiveStatus, string> = {
  pending: "pending",
  acknowledged: "acknowledged",
  completed: "completed",
  deferred: "deferred",
  dismissed: "dismissed",
};

interface StatusBadgeProps {
  status: DirectiveStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
