"use client";

import { useAgentModel, useSetAgentModel } from "@/lib/hooks/useAgentModel";
import { useAutoModel, useSetAutoModel } from "@/lib/hooks/useAutoModel";

const MODELS = [
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku",
    description: "Fast & cheap",
    activeClass:
      "border-emerald-500 bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-500/40",
    dotClass: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
    idleClass:
      "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet",
    description: "Balanced",
    activeClass:
      "border-blue-500 bg-blue-950/60 text-blue-300 ring-1 ring-blue-500/40",
    dotClass: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]",
    idleClass:
      "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
  },
  {
    id: "claude-opus-4-6",
    label: "Opus",
    description: "Most capable",
    activeClass:
      "border-purple-500 bg-purple-950/60 text-purple-300 ring-1 ring-purple-500/40",
    dotClass: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.6)]",
    idleClass:
      "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
  },
];

export default function ModelSwitcher() {
  const { data, isLoading } = useAgentModel();
  const setModel = useSetAgentModel();
  const { data: autoData } = useAutoModel();
  const setAutoModel = useSetAutoModel();

  const currentModel = data?.model ?? "";
  const autoEnabled = autoData?.enabled ?? false;
  const minimumModel = autoData?.minimumModel ?? "claude-sonnet-4-6";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Agent Model
      </p>

      {/* Auto-model toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoEnabled}
          onChange={() => setAutoModel.mutate({ enabled: !autoEnabled })}
          className="sr-only peer"
        />
        <span className="relative w-8 h-4 bg-zinc-700 rounded-full peer-checked:bg-amber-600 transition-colors">
          <span
            className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
              autoEnabled ? "translate-x-4" : ""
            }`}
          />
        </span>
        <span className="text-xs text-zinc-400">
          Auto <span className="text-zinc-500">(by task complexity)</span>
        </span>
      </label>

      {/* Minimum model selector — only when auto is enabled */}
      {autoEnabled && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Minimum:</span>
          <select
            value={minimumModel}
            onChange={(e) =>
              setAutoModel.mutate({ minimumModel: e.target.value })
            }
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-1.5 py-0.5"
          >
            {MODELS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Manual model buttons */}
      <div className="flex flex-col gap-1.5">
        {MODELS.map(
          ({ id, label, description, activeClass, dotClass, idleClass }) => {
            const isActive = currentModel === id;
            const isPending = setModel.isPending;
            return (
              <button
                key={id}
                type="button"
                disabled={isPending || isLoading || autoEnabled}
                onClick={() => {
                  if (!isActive) setModel.mutate(id);
                }}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
                  isActive ? activeClass : idleClass
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full shrink-0 transition-all ${
                    isActive ? dotClass : "bg-zinc-600"
                  }`}
                />
                <span className="truncate">{label}</span>
                <span className="ml-auto text-xs font-normal opacity-60 truncate">
                  {isActive
                    ? autoEnabled
                      ? "Fallback"
                      : "Active"
                    : description}
                </span>
              </button>
            );
          }
        )}
      </div>
      {setModel.isError && (
        <p className="text-xs text-red-400">Failed to switch model.</p>
      )}
    </div>
  );
}
