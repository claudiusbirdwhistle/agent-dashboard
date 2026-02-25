"use client";

import { useState } from "react";
import DirectiveForm from "@/components/directives/DirectiveForm";
import DirectiveList from "@/components/directives/DirectiveList";
import {
  useDirectives,
  useCreateDirective,
  useDeleteDirective,
} from "@/lib/hooks/useDirectives";
import type { DirectiveType, DirectivePriority } from "@/types";

export default function DirectivesPage() {
  const { data: directives, isLoading, error } = useDirectives();
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
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Directives</h1>

      {toast && (
        <div
          role="status"
          className={`mb-4 p-3 rounded text-sm ${
            toast.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">New Directive</h2>
        <DirectiveForm onSubmit={handleSubmit} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">All Directives</h2>
        {isLoading && <p>Loading…</p>}
        {error && <p className="text-red-600">Failed to load directives.</p>}
        {directives && (
          <DirectiveList directives={directives} onDelete={handleDelete} />
        )}
      </section>
    </main>
  );
}
