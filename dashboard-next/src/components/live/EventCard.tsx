"use client";

import { useState } from "react";
import type { LiveEvent } from "@/types";

const TYPE_STYLES: Record<LiveEvent["type"], string> = {
  system: "bg-blue-900/40 border-blue-700 text-blue-300",
  text: "bg-zinc-800 border-zinc-700 text-zinc-200",
  "tool-use": "bg-violet-900/40 border-violet-700 text-violet-300",
  result: "bg-green-900/40 border-green-700 text-green-300",
  error: "bg-red-900/40 border-red-700 text-red-300",
};

const TYPE_LABELS: Record<LiveEvent["type"], string> = {
  system: "system",
  text: "text",
  "tool-use": "tool",
  result: "result",
  error: "error",
};

interface EventCardProps {
  event: LiveEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  const styleClass = TYPE_STYLES[event.type] ?? TYPE_STYLES.text;
  const label = TYPE_LABELS[event.type] ?? event.type;
  const ts = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div
      className={`rounded border px-3 py-2 text-sm cursor-pointer select-none ${styleClass}`}
      onClick={() => setCollapsed((c) => !c)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {label}
        </span>
        <span className="text-[10px] opacity-50">{ts}</span>
      </div>
      {!collapsed && (
        <p className="mt-1 whitespace-pre-wrap break-words leading-snug">
          {event.content}
        </p>
      )}
    </div>
  );
}
