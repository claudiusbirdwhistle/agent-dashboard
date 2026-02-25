"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDirectives } from "@/lib/hooks/useDirectives";

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Directives", href: "/directives" },
  { label: "Files", href: "/files" },
];

const QUICK_LINKS = [
  { label: "Objectives", href: "/files/state/dev-objectives.json" },
  { label: "CLAUDE.md", href: "/files/agent/CLAUDE.md" },
  { label: "Next Prompt", href: "/files/state/next_prompt.txt" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: directives } = useDirectives();

  const pending = (directives ?? [])
    .filter((d) => d.status === "pending")
    .slice(0, 3);

  return (
    <nav className="flex flex-col gap-6 w-52 shrink-0 py-6 px-4 bg-zinc-900 border-r border-zinc-800 min-h-screen">
      {/* Nav links */}
      <div className="flex flex-col gap-1">
        {NAV_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              pathname === href
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Pending directives */}
      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Pending ({pending.length})
          </p>
          {pending.map((d) => (
            <div
              key={d.id}
              className="rounded border border-orange-800 bg-orange-950 px-2 py-1.5"
            >
              <p className="text-xs text-orange-300 line-clamp-2">{d.text}</p>
              <p className="text-[10px] text-orange-500 mt-0.5">
                {d.type} · {d.priority}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Quick Links
        </p>
        {QUICK_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
