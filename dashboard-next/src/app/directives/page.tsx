"use client";

import { useState } from "react";
import DirectiveForm from "@/components/directives/DirectiveForm";
import TaskList from "@/components/directives/TaskList";
import ModelSwitcher from "@/components/directives/ModelSwitcher";
import {
  useCreateDirective,
  useUpdateDirective,
  useDeleteDirective,
} from "@/lib/hooks/useDirectives";
import { useTasks } from "@/lib/hooks/useTasks";
import type { DirectiveType, DirectivePriority } from "@/types";

export default function TasksPage() {
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useTasks();
  const createDirective = useCreateDirective();
  const updateDirective = useUpdateDirective();
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
      showToast("Task submitted", "success");
    } catch {
      showToast("Failed to submit task", "error");
    }
  }

  async function handleEdit(
    id: string,
    data: { text: string; type: DirectiveType; priority: DirectivePriority },
  ) {
    try {
      await updateDirective.mutateAsync({ id, data });
      showToast("Task updated", "success");
    } catch {
      showToast("Failed to update task", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDirective.mutateAsync(id);
      showToast("Task deleted", "success");
    } catch {
      showToast("Failed to delete task", "error");
    }
  }

  return (
    <div className="p-6 flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-zinc-100">Tasks</h1>

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
          New Task
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
          All Tasks
        </h2>
        {tasksLoading && <p className="text-sm text-zinc-500">Loading…</p>}
        {tasksError && <p className="text-sm text-red-400">Failed to load tasks.</p>}
        {tasksData && (
          <TaskList tasks={tasksData.tasks} onEdit={handleEdit} onDelete={handleDelete} />
        )}
      </section>
    </div>
  );
}
