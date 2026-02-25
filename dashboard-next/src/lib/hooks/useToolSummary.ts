"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchToolSummary(tool: string): Promise<unknown> {
  const res = await fetch(`/api/${tool}/summary`);
  if (!res.ok) throw new Error(`Failed to fetch ${tool} summary: ${res.status}`);
  return res.json();
}

export function useToolSummary(tool: string) {
  return useQuery({
    queryKey: ["tool-summary", tool],
    queryFn: () => fetchToolSummary(tool),
    refetchInterval: 15_000,
    enabled: !!tool,
  });
}
