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

const TYPES: DirectiveType[] = ["task", "focus", "policy"];
const PRIORITIES: DirectivePriority[] = ["urgent", "normal", "background"];

export default function DirectiveForm({ onSubmit }: DirectiveFormProps) {
  const [text, setText] = useState("");
  const [type, setType] = useState<DirectiveType>("task");
  const [priority, setPriority] = useState<DirectivePriority>("normal");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ text: text.trim(), type, priority });
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="directive-form">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What should the agent do?"
        rows={3}
      />
      <div className="type-selector">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={type === t ? "active" : ""}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="priority-selector">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={priority === p ? "active" : ""}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}
