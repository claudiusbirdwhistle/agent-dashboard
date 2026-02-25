"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentStatus } from "@/types";

async function fetchStatus(): Promise<AgentStatus> {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.status}`);
  return res.json();
}

async function toggleAgent(): Promise<AgentStatus> {
  const res = await fetch("/api/toggle", { method: "POST" });
  if (!res.ok) throw new Error(`Failed to toggle agent: ${res.status}`);
  return res.json();
}

export function useStatus() {
  return useQuery<AgentStatus>({
    queryKey: ["status"],
    queryFn: fetchStatus,
    refetchInterval: 5000,
  });
}

export function useToggleAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });
}
