"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AgentModelResponse {
  model: string;
  label: string;
  available?: string[];
  liveModel?: string;
  liveLabel?: string;
  liveAutoSelected?: boolean;
  liveTimestamp?: string;
}

async function fetchAgentModel(): Promise<AgentModelResponse> {
  const res = await fetch("/api/agent-model");
  if (!res.ok) throw new Error(`Failed to fetch agent model: ${res.status}`);
  return res.json();
}

async function setAgentModel(model: string): Promise<AgentModelResponse> {
  const res = await fetch("/api/agent-model", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error(`Failed to set agent model: ${res.status}`);
  return res.json();
}

export function useAgentModel() {
  return useQuery<AgentModelResponse>({
    queryKey: ["agent-model"],
    queryFn: fetchAgentModel,
    refetchInterval: 10000,
  });
}

export function useSetAgentModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setAgentModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-model"] });
    },
  });
}
