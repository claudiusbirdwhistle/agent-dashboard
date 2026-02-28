"use client";

import { useState } from "react";
import DirectiveForm from "@/components/directives/DirectiveForm";
import TaskList from "@/components/directives/TaskList";
import ModelSwitcher from "@/components/directives/ModelSwitcher";
import ChatPanel from "@/components/chat/ChatPanel";
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
  const [mobileView, setMobileView] = useState<"tasks" | "chat">("tasks");

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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile view toggle */}
      <div className="lg:hidden flex border-b border-zinc-800">
        <button
          onClick={() => setMobileView("tasks")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            mobileView === "tasks"
              ? "text-white border-b-2 border-blue-500"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setMobileView("chat")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            mobileView === "chat"
              ? "text-white border-b-2 border-blue-500"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Chat
        </button>
      </div>

      {/* Desktop: side-by-side | Mobile: toggled */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Tasks panel */}
        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 sm:gap-8 ${
            mobileView === "chat" ? "hidden lg:flex" : "flex"
          }`}
        >
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
            <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 items-stretch xl:items-start">
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4 sm:p-5 max-w-2xl flex-1">
                <DirectiveForm onSubmit={handleSubmit} />
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4 sm:p-5 xl:w-72 xl:shrink-0">
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

        {/* Chat panel */}
        <div
          className={`lg:w-[420px] xl:w-[480px] lg:shrink-0 lg:border-l border-zinc-800 flex flex-col min-h-0 ${
            mobileView === "tasks" ? "hidden lg:flex" : "flex flex-1"
          }`}
        >
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
