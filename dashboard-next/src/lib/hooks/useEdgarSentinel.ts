"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PipelineConfig, PipelineJob } from "@/components/tools/edgar-sentinel/types";

async function fetchJob(jobId: string): Promise<PipelineJob> {
  const res = await fetch(`/api/edgar-sentinel/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Failed to fetch job: ${res.status}`);
  return res.json();
}

async function startPipeline(config: PipelineConfig): Promise<{ jobId: string }> {
  const res = await fetch("/api/edgar-sentinel/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Failed to start pipeline: ${res.status}`);
  }
  return res.json();
}

async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/edgar-sentinel/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to cancel job: ${res.status}`);
}

export function useEdgarSentinelJob(jobId: string | null) {
  return useQuery({
    queryKey: ["edgar-sentinel-job", jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.status === "completed" || data.status === "failed") return false;
      return 2000;
    },
  });
}

export function useStartPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startPipeline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edgar-sentinel-job"] });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edgar-sentinel-job"] });
    },
  });
}
