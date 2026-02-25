"use client";

import { useQuery } from "@tanstack/react-query";
import type { LiveEvent } from "@/types";

interface LiveResponse {
  running: boolean;
  log: string | null;
  events: LiveEvent[];
}

async function fetchLive(): Promise<LiveEvent[]> {
  const res = await fetch("/api/live");
  if (!res.ok) throw new Error(`Failed to fetch live data: ${res.status}`);
  const data: LiveResponse = await res.json();
  return data.events ?? [];
}

export function useLive() {
  return useQuery<LiveEvent[]>({
    queryKey: ["live"],
    queryFn: fetchLive,
    refetchInterval: 2000,
  });
}
