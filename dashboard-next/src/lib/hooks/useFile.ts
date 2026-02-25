"use client";

import { useQuery } from "@tanstack/react-query";

export interface FileContent {
  type: "file";
  path: string;
  name: string;
  ext: string;
  size: number;
  modified: string;
  content: string;
  html: string | null;
}

async function fetchFile(filePath: string): Promise<FileContent> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return res.json();
}

export function useFile(filePath: string | null) {
  return useQuery<FileContent>({
    queryKey: ["file", filePath],
    queryFn: () => fetchFile(filePath!),
    enabled: !!filePath,
  });
}
