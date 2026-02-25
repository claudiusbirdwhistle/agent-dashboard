import type { DirectiveStatus } from "@/types";

const STYLE: Record<DirectiveStatus, string> = {
  pending: "bg-orange-950 text-orange-300 border-orange-800",
  acknowledged: "bg-blue-950 text-blue-300 border-blue-800",
  completed: "bg-green-950 text-green-300 border-green-800",
  deferred: "bg-yellow-950 text-yellow-300 border-yellow-800",
  dismissed: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

interface StatusBadgeProps {
  status: DirectiveStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${STYLE[status]}`}
    >
      {status}
    </span>
  );
}
