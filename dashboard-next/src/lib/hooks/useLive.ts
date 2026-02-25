"use client";

import { useQuery } from "@tanstack/react-query";
import type { LiveEvent } from "@/types";

async function fetchLive(): Promise<LiveEvent[]> {
  const res = await fetch("/api/live");
  if (!res.ok) throw new Error(`Failed to fetch live data: ${res.status}`);
  return res.json();
}

export function useLive() {
  return useQuery<LiveEvent[]>({
    queryKey: ["live"],
    queryFn: fetchLive,
    refetchInterval: 2000,
  });
}
