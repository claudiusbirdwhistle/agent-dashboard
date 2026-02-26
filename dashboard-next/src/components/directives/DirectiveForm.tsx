"use client";

import { useState } from "react";
import type { DirectiveType, DirectivePriority } from "@/types";

interface DirectiveFormProps {
  onSubmit: (data: {
    text: string;
    type: DirectiveType;
    priority: DirectivePriority;
  }) => Promise<void> | void;
}

const TYPES: { value: DirectiveType; label: string; description: string }[] = [
  { value: "task", label: "Task", description: "A discrete work item to complete" },
  { value: "focus", label: "Focus", description: "Shift the agent's overall priority" },
  { value: "policy", label: "Policy", description: "A standing rule for all future work" },
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

export default function DirectiveForm({ onSubmit }: DirectiveFormProps) {
  const [text, setText] = useState("");
  const [type, setType] = useState<DirectiveType>("task");
  const [priority, setPriority] = useState<DirectivePriority>("normal");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ text: text.trim(), type, priority });
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  const typeDescription = TYPES.find((t) => t.value === type)?.description ?? "";

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What should the agent do?"
        rows={3}
        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-none"
      />

      {/* Type */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</p>
        <div className="flex gap-2">
          {TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
                type === value
                  ? "border-blue-500 bg-blue-950 text-blue-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">{typeDescription}</p>
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Priority</p>
        <div className="flex gap-2">
          {PRIORITIES.map(({ value, label, activeClass, idleClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
                priority === value ? activeClass : idleClass
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !text.trim()}
        className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Task"}
      </button>
    </div>
  );
}
