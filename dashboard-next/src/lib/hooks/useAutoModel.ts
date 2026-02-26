"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AutoModelResponse {
  enabled: boolean;
  minimumModel: string;
  available?: string[];
}

async function fetchAutoModel(): Promise<AutoModelResponse> {
  const res = await fetch("/api/auto-model");
  if (!res.ok) throw new Error(`Failed to fetch auto-model settings: ${res.status}`);
  return res.json();
}

async function updateAutoModel(
  body: Partial<{ enabled: boolean; minimumModel: string }>
): Promise<AutoModelResponse> {
  const res = await fetch("/api/auto-model", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to update auto-model: ${res.status}`);
  return res.json();
}

export function useAutoModel() {
  return useQuery<AutoModelResponse>({
    queryKey: ["auto-model"],
    queryFn: fetchAutoModel,
    refetchInterval: 10000,
  });
}

export function useSetAutoModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAutoModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-model"] });
    },
  });
}
