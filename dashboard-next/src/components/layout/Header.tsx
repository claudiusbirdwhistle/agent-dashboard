"use client";

import { useStatus, useToggleAgent } from "@/lib/hooks/useStatus";
import RateLimitBar from "./RateLimitBar";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { data: status } = useStatus();
  const toggle = useToggleAgent();

  const enabled = status?.enabled ?? false;
  const phase = status?.phase ?? "—";
  const invocations = status?.totalInvocations ?? 0;
  const stalls = status?.stallCount ?? 0;

  return (
    <header className="flex items-center gap-2 sm:gap-4 lg:gap-6 px-3 sm:px-6 py-2.5 sm:py-3 bg-zinc-900 border-b border-zinc-800">
      {/* Hamburger menu — mobile only */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="md:hidden p-2 -ml-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>

      {/* Title — compact on mobile */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm sm:text-base font-semibold text-white truncate">Agent Dashboard</h1>
        <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5 truncate">Phase: {phase}</p>
      </div>

      {/* Rate Limit — hidden on small screens */}
      <div className="hidden lg:block">
        <RateLimitBar />
      </div>

      {/* KPIs — minimal on mobile, full on sm+ */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 text-sm shrink-0">
        <div className="text-center">
          <p className={`font-semibold text-xs sm:text-sm ${enabled ? "text-green-400" : "text-red-400"}`}>
            {enabled ? "●" : "●"}
          </p>
        </div>
        <div className="hidden sm:block text-center">
          <p className="text-zinc-500 text-xs">Invocations</p>
          <p className="text-white font-semibold">{invocations}</p>
        </div>
        <div className="hidden sm:block text-center">
          <p className="text-zinc-500 text-xs">Stalls</p>
          <p className="text-white font-semibold">{stalls}</p>
        </div>
        {status?.diskUsage && (
          <div className="hidden lg:block text-center">
            <p className="text-zinc-500 text-xs">Disk</p>
            <p className="text-white font-semibold">{status.diskUsage.percent}</p>
          </div>
        )}
      </div>

      {/* Toggle button — larger touch target on mobile */}
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={`px-3 py-2 sm:py-1.5 rounded text-xs font-medium transition-colors shrink-0 min-h-[44px] sm:min-h-0 ${
          enabled
            ? "bg-red-900 text-red-300 hover:bg-red-800"
            : "bg-green-900 text-green-300 hover:bg-green-800"
        }`}
      >
        {toggle.isPending ? "…" : enabled ? "Disable" : "Enable"}
      </button>
    </header>
  );
}
