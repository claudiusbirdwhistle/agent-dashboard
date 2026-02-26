"use client";

import { useQuery } from "@tanstack/react-query";
import type { TasksResponse } from "@/types";

async function fetchTasks(): Promise<TasksResponse> {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

export function useTasks() {
  return useQuery<TasksResponse>({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    refetchInterval: 5000,
  });
}
