"use client";

import { useState } from "react";
import DirectiveForm from "@/components/directives/DirectiveForm";
import DirectiveList from "@/components/directives/DirectiveList";
import ModelSwitcher from "@/components/directives/ModelSwitcher";
import {
  useDirectives,
  useCreateDirective,
  useDeleteDirective,
} from "@/lib/hooks/useDirectives";
import { useStatus } from "@/lib/hooks/useStatus";
import type { DirectiveType, DirectivePriority } from "@/types";

export default function DirectivesPage() {
  const { data: directives, isLoading, error } = useDirectives();
  const { data: status } = useStatus();
  const createDirective = useCreateDirective();
  const deleteDirective = useDeleteDirective();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(data: {
    text: string;
    type: DirectiveType;
    priority: DirectivePriority;
  }) {
    try {
      await createDirective.mutateAsync(data);
      showToast("Directive submitted", "success");
    } catch {
      showToast("Failed to submit directive", "error");
    }
  }

  function handleDelete(id: string) {
    deleteDirective.mutate(id, {
      onError: () => showToast("Failed to delete directive", "error"),
    });
  }

  return (
    <div className="p-6 flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-zinc-100">Directives</h1>

      {toast && (
        <div
          role="status"
          className={`p-3 rounded text-sm font-medium ${
            toast.type === "success"
              ? "bg-green-950 border border-green-800 text-green-300"
              : "bg-red-950 border border-red-800 text-red-300"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">
          New Directive
        </h2>
        <div className="flex gap-6 items-start flex-wrap">
          <div className="rounded border border-zinc-800 bg-zinc-900 p-5 max-w-2xl flex-1 min-w-[320px]">
            <DirectiveForm onSubmit={handleSubmit} />
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900 p-5 w-80 shrink-0">
            <ModelSwitcher />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">
          All Directives
        </h2>
        {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-400">Failed to load directives.</p>}
        {directives && (
          <DirectiveList
            directives={directives}
            onDelete={handleDelete}
            currentDirectiveId={status?.currentDirectiveId}
          />
        )}
      </section>
    </div>
  );
}
