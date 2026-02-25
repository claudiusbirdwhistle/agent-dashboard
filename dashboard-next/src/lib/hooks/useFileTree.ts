"use client";

import { useQuery } from "@tanstack/react-query";
import type { FileNode } from "@/types";

interface DirResponse {
  type: "directory";
  files: FileNode[];
}

async function fetchTree(dirPath: string): Promise<FileNode[]> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(dirPath)}`);
  if (!res.ok) throw new Error(`Failed to fetch tree: ${res.status}`);
  const data: DirResponse = await res.json();
  return data.files ?? [];
}

export function useFileTree(dirPath: string) {
  return useQuery<FileNode[]>({
    queryKey: ["fileTree", dirPath],
    queryFn: () => fetchTree(dirPath),
    refetchInterval: 15000,
    enabled: !!dirPath,
  });
}
