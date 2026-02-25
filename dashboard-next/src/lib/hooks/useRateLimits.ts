"use client";

import { useQuery } from "@tanstack/react-query";

export interface RateLimitInfo {
  type: string | null;
  utilization: number | null;
  status: string | null;
  resetsAt: string | null;
  isUsingOverage: boolean;
  surpassedThreshold: number | null;
}

async function fetchRateLimits(): Promise<RateLimitInfo> {
  const res = await fetch("/api/rate-limit");
  if (!res.ok) throw new Error(`Failed to fetch rate limits: ${res.status}`);
  return res.json();
}

export function useRateLimits() {
  return useQuery<RateLimitInfo>({
    queryKey: ["rate-limits"],
    queryFn: fetchRateLimits,
    refetchInterval: 10000,
  });
}
