"use client";

import Link from "next/link";

interface BreadcrumbsProps {
  segments: string[];
}

export default function Breadcrumbs({ segments }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-zinc-400 mb-4">
      <Link href="/files" className="hover:text-white transition-colors">
        Files
      </Link>
      {segments.map((seg, i) => {
        const href = "/files/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            <span className="text-zinc-600">/</span>
            {isLast ? (
              <span className="text-zinc-200">{seg}</span>
            ) : (
              <Link href={href} className="hover:text-white transition-colors">
                {seg}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
