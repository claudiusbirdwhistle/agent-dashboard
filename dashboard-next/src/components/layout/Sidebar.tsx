"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDirectives } from "@/lib/hooks/useDirectives";

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Directives", href: "/directives" },
  { label: "Files", href: "/files" },
];

const TOOL_LINKS = [
  { label: "Sci Trends", href: "/tools/sci-trends" },
  { label: "Climate", href: "/tools/climate" },
  { label: "Sea Level", href: "/tools/sea-level" },
  { label: "Ocean Warming", href: "/tools/ocean-warming" },
  { label: "Attention Gap", href: "/tools/attention-gap" },
  { label: "UK Grid Decarb", href: "/tools/uk-grid-decarb" },
  { label: "Solar Cycles", href: "/tools/solar-cycles" },
  { label: "Exoplanets", href: "/tools/exoplanet-census" },
  { label: "COVID Attention", href: "/tools/covid-attention" },
  { label: "US Debt", href: "/tools/us-debt-dynamics" },
  { label: "Currency", href: "/tools/currency-contagion" },
  { label: "Biodiversity", href: "/tools/gbif-biodiversity" },
  { label: "River Flow", href: "/tools/river-flow" },
  { label: "Solar-Seismic", href: "/tools/solar-seismic" },
];

const QUICK_LINKS = [
  { label: "Journal", href: "/files/state/journal.md" },
  { label: "Objectives", href: "/files/state/dev-objectives.json" },
  { label: "CLAUDE.md", href: "/files/agent/CLAUDE.md" },
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

      {/* Tool pages */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Tools
        </p>
        {TOOL_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 text-xs transition-colors rounded ${
              pathname === href
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

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
