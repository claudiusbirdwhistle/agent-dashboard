"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Directive, DirectiveType, DirectivePriority } from "@/types";

async function fetchDirectives(): Promise<Directive[]> {
  const res = await fetch("/api/directives");
  if (!res.ok) throw new Error(`Failed to fetch directives: ${res.status}`);
  return res.json();
}

async function createDirective(data: {
  text: string;
  type: DirectiveType;
  priority: DirectivePriority;
}): Promise<Directive> {
  const res = await fetch("/api/directives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create directive: ${res.status}`);
  return res.json();
}

async function updateDirective(
  id: string,
  data: { text?: string; type?: DirectiveType; priority?: DirectivePriority },
): Promise<Directive> {
  const res = await fetch(`/api/directives/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update directive: ${res.status}`);
  return res.json();
}

async function deleteDirective(id: string): Promise<void> {
  const res = await fetch(`/api/directives/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete directive: ${res.status}`);
}

export function useDirectives() {
  return useQuery<Directive[]>({
    queryKey: ["directives"],
    queryFn: fetchDirectives,
    refetchInterval: 5000,
  });
}

export function useCreateDirective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDirective,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directives"] });
    },
  });
}

export function useUpdateDirective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { text?: string; type?: DirectiveType; priority?: DirectivePriority } }) =>
      updateDirective(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directives"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteDirective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDirective,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directives"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
